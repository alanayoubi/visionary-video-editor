import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { Message, Sender, TimelineEvent, Clip, VisualFragment } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- HELPER: ROBUST GENERATION WITH RETRY & FALLBACK ---
/**
 * Tries to generate content with Gemini 3 Pro.
 * If Rate Limit (429) is hit:
 * 1. Retries once after a delay.
 * 2. If still failing, falls back to Gemini 2.5 Flash (higher quotas).
 */
const generateWithFallback = async (
  primaryModel: string,
  fallbackModel: string,
  generateParams: any
): Promise<GenerateContentResponse> => {
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Attempt 1: Primary Model
    return await ai.models.generateContent({
      model: primaryModel,
      ...generateParams
    });
  } catch (error: any) {
    const isRateLimit = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
    
    if (isRateLimit) {
      console.warn(`Rate limit hit on ${primaryModel}. Waiting 4s to retry...`);
      await delay(4000);

      try {
        // Attempt 2: Retry Primary
        return await ai.models.generateContent({
          model: primaryModel,
          ...generateParams
        });
      } catch (retryError: any) {
        // Attempt 3: Fallback Model
        console.warn(`Primary model exhausted. Falling back to ${fallbackModel}.`);
        return await ai.models.generateContent({
          model: fallbackModel,
          ...generateParams
        });
      }
    }

    throw error; // Re-throw other errors
  }
};

/**
 * Uploads a file to Google's GenAI File API and waits for it to be processed.
 * This is required for large files (up to 2GB) and ensures they are ready for analysis.
 */
export const uploadMedia = async (file: File | Blob): Promise<string> => {
  try {
    const uploadResult = await ai.files.upload({
      file: file,
      config: { 
        displayName: (file instanceof File) ? file.name : "uploaded_video",
        mimeType: file.type || 'video/mp4' 
      }
    });

    const fileUri = uploadResult.uri;
    const fileName = uploadResult.name; // The API's internal name

    // Poll for the file to be processed (STATE must be ACTIVE)
    let isProcessing = true;
    while (isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const fileStatus = await ai.files.get({ name: fileName });
      
      if (fileStatus.state === 'ACTIVE') {
        isProcessing = false;
      } else if (fileStatus.state === 'FAILED') {
        throw new Error("Video processing failed on Gemini servers.");
      }
      // If 'PROCESSING', loop again
    }

    return fileUri;
  } catch (error) {
    console.error("File Upload Error:", error);
    throw new Error("Failed to upload video to Gemini. Please try again.");
  }
};

/**
 * TRANSCRIPTION-FIRST ANALYSIS
 * 
 * Instead of chopping the video into arbitrary 3-second visual chunks, 
 * we analyze the AUDIO stream to find natural sentence boundaries.
 * 
 * Strategy:
 * 1. Transcribe the video.
 * 2. Break it into "Chapters" or "Thoughts" (typically 10-30 seconds).
 * 3. Each clip matches a complete spoken idea.
 */
export const generateVideoTimeline = async (
  fileUri: string,
  mimeType: string
): Promise<TimelineEvent[]> => {
  try {
    const prompt = `
    Analyze this video using a **Transcription-First** approach.
    
    **YOUR GOAL:**
    Break the video into logical "Clips" based on the spoken narration.
    
    **SEGMENTATION RULES:**
    1. **Follow the Speech**: Create a new segment for each complete thought, sentence, or logical paragraph.
    2. **Avoid Micro-Cuts**: Do NOT cut every 3 seconds. Aim for clips that are **10 to 30 seconds long**.
    3. **Complete Sentences**: A clip MUST start at the beginning of a sentence and end at the completion of a sentence. Never cut in the middle of a phrase.
    4. **Silence**: If there is a long pause between topics, end the clip before the pause, and start the next clip after the pause.
    
    **OUTPUT DATA:**
    For each segment, provide:
    - **timestamp**: Start time (MM:SS)
    - **seconds**: Start time in seconds (number)
    - **duration**: Exact duration of this spoken segment.
    - **type**: "audio" (This is the primary type).
    - **description**: The VERBATIM transcription of what was said.
    
    **VISUAL CONTEXT (Secondary):**
    If a major visual change happens (e.g., "Settings Menu Opened"), add a separate event for it, but do NOT let it dictate the clip boundaries. The Audio dictates the clips.
    
    **REDUNDANCY:**
    Identify "um", "uh", or stuttering as "redundancy" events.

    **OUTPUT FORMAT:**
    Return strictly a JSON array.
    Example:
    [
      { "timestamp": "00:00", "seconds": 0, "duration": 12.5, "type": "audio", "description": "Welcome to this tutorial. Today we will show you how to set up your profile." },
      { "timestamp": "00:12", "seconds": 12.5, "duration": 15.2, "type": "audio", "description": "First, navigate to the top right corner and click on the settings icon." },
      { "timestamp": "00:14", "seconds": 14, "type": "visual", "description": "Mouse clicks Settings Icon" }
    ]
    `;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              mimeType: mimeType,
              fileUri: fileUri,
            },
          },
          { text: prompt }
        ],
      }
    ];

    const response = await generateWithFallback(
      "gemini-3-pro-preview", // Primary
      "gemini-2.5-flash",     // Fallback
      {
        contents: contents,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are a professional transcriber and video editor. Output only valid JSON.",
          temperature: 0.1,
        }
      }
    );

    const text = response.text || "[]";
    const jsonStr = text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr) as TimelineEvent[];

  } catch (error) {
    console.error("Timeline Generation Error:", error);
    return [];
  }
};

/**
 * Detects periods of silence and inactivity (Dead Air).
 */
export const detectSilenceAndInactivity = async (
  fileUri: string,
  mimeType: string
): Promise<TimelineEvent[]> => {
  try {
    const prompt = `
    Analyze this video to find "Dead Air" — moments that should likely be cut.
    
    **CRITERIA FOR DETECTION:**
    1. **Audio Silence**: No speech or meaningful audio.
    2. **Visual Inactivity**: The screen is static, loading, or nothing important is happening.
    
    **OUTPUT:**
    Return a JSON array of events with:
    - "timestamp": Start time (MM:SS)
    - "seconds": Start time in seconds
    - "duration": Length of the silence in seconds
    - "type": "silence"
    - "description": Why this should be cut.

    Example:
    [
      { "timestamp": "00:45", "seconds": 45, "duration": 5.5, "type": "silence", "description": "Silence and static screen waiting for download." }
    ]
    `;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              mimeType: mimeType,
              fileUri: fileUri,
            },
          },
          { text: prompt }
        ],
      }
    ];

    const response = await generateWithFallback(
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
      {
        contents: contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      }
    );

    const text = response.text || "[]";
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Silence Detection Error:", error);
    return [];
  }
};

/**
 * Takes the raw transcripts from the clips and asks Gemini to rewrite them.
 */
export const polishClipTranscripts = async (clips: Clip[]): Promise<{id: string, improvedText: string}[]> => {
    try {
        const inputPayload = clips
            .filter(c => c.transcript && c.transcript.length > 0)
            .map(c => ({ id: c.id, text: c.transcript }));

        const prompt = `
        You are a **Charismatic Expert** and Video Creator.
        I will provide raw transcripts from a video.
        
        **YOUR TASK:**
        Rewrite these transcripts to sound confident, knowledgeable, and engaging—like a top-tier educator or YouTuber explaining a concept to a smart friend.
        
        **TONE GUIDELINES:**
        1. **Retain Personality**: Do NOT make it sound like a corporate robot or a generic manual. Keep it punchy.
        2. **Simple but Deep**: Use simple language, but demonstrate deep expertise.
        3. **Remove Clutter**: Cut the "ums", "uhs", and hesitation, but keep the *flow* and *energy*.
        4. **Natural Speaking**: Write numbers as words ("fifty percent" not "50%"). Use natural sentence structures.
        
        **RULES:**
        1. **Accuracy**: Do NOT change the factual instructions. The visuals depend on this.
        2. **Consistency**: Ensure the story flows smoothly from one clip to the next.
        
        **INPUT DATA:**
        ${JSON.stringify(inputPayload)}

        **OUTPUT FORMAT:**
        Return a valid JSON Array of objects with keys: "id" and "improvedText".
        `;

        const response = await generateWithFallback(
          "gemini-3-pro-preview",
          "gemini-2.5-flash",
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.4
            }
          }
        );

        const text = response.text || "[]";
        const jsonStr = text.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Polish Script Error:", error);
        return [];
    }
};

/**
 * Sends a message to Gemini using the uploaded File URI and the pre-computed timeline context.
 */
export const sendMessageToGemini = async (
  currentPrompt: string,
  fileUri: string,
  mimeType: string,
  chatHistory: Message[],
  timelineContext: TimelineEvent[]
): Promise<string> => {
  try {
    const timelineString = timelineContext.map(e => 
      `[${e.timestamp}] [${e.type.toUpperCase()}]: ${e.description}`
    ).join('\n');

    const contextInstruction = `
    I have already analyzed this video. Here is the strict timeline of events:
    
    --- START VIDEO TIMELINE ---
    ${timelineString}
    --- END VIDEO TIMELINE ---

    Use this timeline to answer user questions.
    `;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            fileData: { mimeType: mimeType, fileUri: fileUri },
          },
          { text: `Here is the video file. ${contextInstruction} \n\nI am ready to ask questions.` }
        ]
      },
      {
        role: 'model',
        parts: [{ text: "I have received the video and the deep scan timeline. I am ready to answer questions based on this data." }]
      },
      ...chatHistory.map(msg => ({
        role: msg.role === Sender.User ? 'user' : 'model',
        parts: [{ text: msg.text }]
      })),
      {
        role: 'user',
        parts: [{ text: currentPrompt }]
      }
    ];

    const response = await generateWithFallback(
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
      {
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4,
        }
      }
    );

    return response.text || "I processed the video but could not generate a text response.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to analyze video. Ensure the API key is valid.");
  }
};