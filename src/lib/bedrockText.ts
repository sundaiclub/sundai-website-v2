import { BedrockOpenAI } from 'openai';

export const BEDROCK_TEXT_MODEL = 'openai.gpt-5.6-luna';

export function isBedrockTextConfigured(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.AWS_REGION
  );
}

function createBedrockClient(): BedrockOpenAI {
  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!apiKey) {
    throw new Error('AWS_BEARER_TOKEN_BEDROCK is not configured');
  }

  const awsRegion = process.env.AWS_REGION;
  if (!awsRegion) {
    throw new Error('AWS_REGION is not configured');
  }

  return new BedrockOpenAI({ apiKey, awsRegion });
}

export async function generateBedrockText(input: string): Promise<string> {
  const response = await createBedrockClient().responses.create({
    model: BEDROCK_TEXT_MODEL,
    reasoning: { effort: 'none' },
    input,
  });

  return response.output_text;
}

export async function* streamBedrockText(
  input: string
): AsyncGenerator<string> {
  const response = await createBedrockClient().responses.create({
    model: BEDROCK_TEXT_MODEL,
    reasoning: { effort: 'none' },
    input,
    stream: true,
  });

  for await (const event of response) {
    if (event.type === 'response.output_text.delta' && event.delta) {
      yield event.delta;
    }
  }
}
