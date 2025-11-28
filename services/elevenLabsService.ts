
import { ElevenLabsVoice, AppSettings } from '../types';

const BASE_URL = "https://api.elevenlabs.io/v1";

export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}

export interface GeneratedAudioWithTimestamps {
    audioBase64: string;
    alignment: AlignmentData;
}

export const fetchVoices = async (apiKey: string): Promise<ElevenLabsVoice[]> => {
  if (!apiKey) return [];
  
  try {
    const response = await fetch(`${BASE_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch voices. Check API Key.");
    }

    const data = await response.json();
    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url
    }));
  } catch (error) {
    console.error("ElevenLabs Fetch Error:", error);
    throw error;
  }
};

export const generateSpeech = async (
  apiKey: string, 
  text: string,
  settings: AppSettings
): Promise<string> => {
  try {
    const response = await fetch(`${BASE_URL}/text-to-speech/${settings.elevenLabsVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: settings.elevenLabsModelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: settings.elevenLabsStability,
          similarity_boost: settings.elevenLabsSimilarity,
          style: settings.elevenLabsStyle,
          use_speaker_boost: settings.elevenLabsSpeakerBoost
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail?.message || "Generation failed");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob); // Create a playable URL
  } catch (error) {
    console.error("ElevenLabs Generation Error:", error);
    throw error;
  }
};

export const generateSpeechWithTimestamps = async (
    apiKey: string,
    text: string,
    settings: AppSettings
): Promise<GeneratedAudioWithTimestamps> => {
    try {
        // Use 'with-timestamps' endpoint to get alignment info
        const response = await fetch(`${BASE_URL}/text-to-speech/${settings.elevenLabsVoiceId}/with-timestamps`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: settings.elevenLabsModelId || "eleven_multilingual_v2",
                voice_settings: {
                    stability: settings.elevenLabsStability,
                    similarity_boost: settings.elevenLabsSimilarity,
                    style: settings.elevenLabsStyle,
                    use_speaker_boost: settings.elevenLabsSpeakerBoost
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || "Generation failed");
        }

        const data = await response.json();
        return {
            audioBase64: data.audio_base64,
            alignment: data.alignment
        };

    } catch (error) {
        console.error("ElevenLabs Timestamp Generation Error:", error);
        throw error;
    }
};
