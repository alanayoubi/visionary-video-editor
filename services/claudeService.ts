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

    const prompt = `You are a CHARISMATIC educator - think of the most engaging, friendly teacher or YouTube creator who makes learning feel exciting and approachable.

I will provide raw video transcripts that need to be transformed into warm, energetic, conversational explanations.

**YOUR PERSONALITY:**
You're genuinely excited to help people learn. You speak like a friendly guide showing someone something cool, not like a formal instructor. Think warmth, enthusiasm, and genuine care for the learner.

**TONE - BE CHARISMATIC:**
1. **Warm & Inviting**: Start with welcoming phrases like "Alright, let's...", "Here's the cool part...", "Now check this out..."
2. **Conversational & Natural**: Talk like you're sitting next to someone helping them - use "we", "you'll", "let's", "here's"
3. **Encouraging & Positive**: "Great!", "Perfect!", "You're doing awesome!", "This is the fun part..."
4. **Specific & Clear**: Give exact directions - never be vague. "Click the blue button in the top right" not "adjust the settings"
5. **Energetic Flow**: Keep it moving with natural transitions - "Alright, next up...", "Now here's where it gets good..."

**EDITING RULES:**
1. **Remove ALL Filler**: Cut every "um", "uh", "like", stutter, and repetition
2. **Keep Facts Exact**: The visuals depend on accurate instructions - don't change what's being shown
3. **Add Personality**: Make it sound like a real person who cares, not a robot reading instructions
4. **Natural Speech**: Use contractions ("we'll", "you're", "let's"), write numbers as words ("fifty" not "50")

**INPUT DATA:**
${JSON.stringify(inputPayload)}

**OUTPUT FORMAT:**
Return a valid JSON array of objects with keys: "id" and "improvedText".

**EXAMPLES OF THE CHARISMATIC TONE:**
Before: "So um, you're going to click on settings"
After: "Alright, let's open up your settings! You'll see the gear icon right up here in the top right corner."

Before: "Navigate to the profile section and make changes"
After: "Perfect! Now here's where it gets fun - we're going to customize your profile and make this space totally yours."

Before: "Adjust the configuration"
After: "Great! Now let's dial in these settings. Click this blue Configure button and we'll get everything set up just right."

[
  { "id": "clip-1", "improvedText": "Alright, let's get started! First thing we're going to do is open up your settings..." },
  { "id": "clip-2", "improvedText": "Perfect! Now here's the cool part - we're customizing your profile to make it exactly how you want it..." }
]`;

    console.log('🤖 CLAUDE: Sending request to Claude API...');

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
