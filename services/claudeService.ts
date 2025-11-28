import Anthropic from '@anthropic-ai/sdk';
import { Clip } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true,
});

/**
 * Uses Claude Sonnet 4.5 to polish clip transcripts with an educator-friendly tone.
 * Claude acts as an experienced educator, making content easy to understand and friendly.
 */
export const polishClipTranscriptsWithClaude = async (
  clips: Clip[]
): Promise<{ id: string; improvedText: string }[]> => {
  try {
    const inputPayload = clips
      .filter((c) => c.transcript && c.transcript.length > 0)
      .map((c) => ({ id: c.id, text: c.transcript }));

    const prompt = `You are an experienced educator who excels at making complex topics accessible and engaging.

I will provide raw video transcripts that need to be polished for clarity and friendliness.

**YOUR ROLE:**
Transform these transcripts as if you're an experienced teacher explaining concepts to eager students—clear, warm, and encouraging without being overly casual or vague.

**TONE GUIDELINES:**
1. **Friendly & Approachable**: Use conversational language that feels like a helpful mentor, not a formal textbook.
2. **Clear & Concrete**: Replace vague phrases with specific, easy-to-understand explanations. Avoid jargon unless you explain it.
3. **Encouraging**: Use positive, supportive language that builds confidence.
4. **Natural Flow**: Write as people actually speak—use contractions, short sentences, and natural transitions.

**EDITING RULES:**
1. **Remove Filler**: Cut "um", "uh", stutters, and unnecessary repetition.
2. **Maintain Accuracy**: Keep all factual instructions intact—the visuals depend on this.
3. **Preserve Structure**: Ensure smooth transitions between clips for a cohesive narrative.
4. **Conversational Numbers**: Write numbers naturally ("fifty percent" not "50%").

**INPUT DATA:**
${JSON.stringify(inputPayload)}

**OUTPUT FORMAT:**
Return a valid JSON array of objects with keys: "id" and "improvedText".

Example:
[
  { "id": "clip-1", "improvedText": "Let's start by opening your settings. You'll find this in the top right corner—look for that gear icon." },
  { "id": "clip-2", "improvedText": "Perfect! Now we're going to customize your profile. This is where you can really make the app your own." }
]`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from Claude's response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('');

    // Parse JSON from response
    const jsonStr = responseText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Claude Polish Script Error:', error);
    return [];
  }
};
