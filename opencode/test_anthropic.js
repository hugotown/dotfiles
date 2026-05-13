import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const anthropic = createAnthropic({
  apiKey: process.env.CLAUDE_CODE_OAUTH_TOKEN,
});

async function main() {
  try {
    const { text } = await generateText({
      model: anthropic('claude-3-7-sonnet-20250219'),
      prompt: 'say hello',
    });
    console.log(text);
  } catch (e) {
    console.error(e.message);
  }
}
main();
