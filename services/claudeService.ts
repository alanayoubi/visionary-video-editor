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
  console.log('🤖 CLAUDE: Starting script polishing with Claude Sonnet 4.5');
  console.log(`🤖 CLAUDE: Processing ${clips.length} clips`);

  try {
    const inputPayload = clips
      .filter((c) => c.transcript && c.transcript.length > 0)
      .map((c) => ({ id: c.id, text: c.transcript }));

    console.log('🤖 CLAUDE: Input payload:', inputPayload);

    const prompt = `You are a CHARISMATIC educator who polishes video scripts to sound more engaging and professional.

I will provide raw video transcripts. Your ONLY job is to improve the DELIVERY and LANGUAGE - NOT the content.

**⚠️ CRITICAL - PRESERVE EXACTLY AS WRITTEN:**
- ALL product names (e.g., "Nano Banana", "Gemini 3", "ChatGPT", etc.)
- ALL brand names and company names
- ALL proper nouns (people, places, organizations)
- ALL technical terms and feature names
- ALL version numbers and specific references
- ALL URLs, links, and code snippets

**🚫 NEVER DO THIS:**
- NEVER change, replace, or "correct" any names mentioned in the transcript
- NEVER substitute one product/brand name for another
- NEVER add names, products, or references that aren't in the original
- NEVER assume what the speaker "meant to say" - use their EXACT words for names
- NEVER hallucinate or invent information not present in the original

**YOUR PERSONALITY:**
You're genuinely excited to help people learn. You speak like a friendly guide showing someone something cool, not like a formal instructor.

**TONE - BE CHARISMATIC:**
1. **Warm & Inviting**: Start with welcoming phrases like "Alright, let's...", "Here's the cool part...", "Now check this out..."
2. **Conversational & Natural**: Talk like you're sitting next to someone helping them - use "we", "you'll", "let's", "here's"
3. **Encouraging & Positive**: "Great!", "Perfect!", "You're doing awesome!", "This is the fun part..."
4. **Specific & Clear**: Give exact directions - never be vague
5. **Energetic Flow**: Keep it moving with natural transitions

**WHAT YOU CAN CHANGE:**
1. **Remove Filler**: Cut "um", "uh", "like", stutters, and repetitions
2. **Improve Flow**: Restructure sentences for better delivery
3. **Add Personality**: Make it sound warm and engaging
4. **Natural Speech**: Use contractions, write numbers as words

**WHAT YOU MUST NOT CHANGE:**
1. **Names**: Every name MUST appear EXACTLY as in the original
2. **Facts**: All instructions and information must stay accurate
3. **Meaning**: The message must remain the same
4. **References**: Any product, tool, or feature mentioned stays exactly as stated

**INPUT DATA:**
${JSON.stringify(inputPayload)}

**OUTPUT FORMAT:**
Return a valid JSON array of objects with keys: "id" and "improvedText".

**EXAMPLE:**
If original says: "So um, we're going to use Nano Banana and Gemini 3 for this"
Correct output: "Alright, let's use Nano Banana and Gemini 3 for this!"
WRONG output: "Let's use Nano Pro and Gemini 2.5 for this!" ← NEVER do this

[
  { "id": "clip-1", "improvedText": "Alright, let's get started! First thing we're going to do is..." },
  { "id": "clip-2", "improvedText": "Perfect! Now here's the cool part..." }
]`;

    console.log('🤖 CLAUDE: Sending request to Claude API...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature to reduce hallucination and preserve accuracy
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('🤖 CLAUDE: Received response from Claude');
    console.log('🤖 CLAUDE: Model used:', message.model);
    console.log('🤖 CLAUDE: Usage:', message.usage);

    // Extract text from Claude's response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('');

    // Parse JSON from response
    const jsonStr = responseText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(jsonStr);

    console.log('🤖 CLAUDE: Successfully polished scripts');
    console.log('🤖 CLAUDE: Result:', result);

    return result;
  } catch (error) {
    console.error('❌ CLAUDE ERROR: Script polishing failed:', error);
    return [];
  }
};
