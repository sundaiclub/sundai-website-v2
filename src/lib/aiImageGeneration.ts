import { BedrockOpenAI } from 'openai';
import Replicate from 'replicate';

export const PROMPT_MODEL = 'openai.gpt-5.6-luna';
const IMAGE_MODEL = 'black-forest-labs/flux-2-klein-9b';

export type GeneratedImage = {
  url: string;
  prompt: string;
};

function getReplicateOutputUrl(output: unknown): string | null {
  if (Array.isArray(output)) {
    const first = output[0];
    if (!first) return null;
    if (typeof first === 'string') return first;
    if (
      typeof first === 'object' &&
      'url' in first &&
      typeof first.url === 'function'
    ) {
      return String(first.url());
    }
  }

  if (typeof output === 'string') return output;
  if (
    output !== null &&
    typeof output === 'object' &&
    'url' in output &&
    typeof output.url === 'function'
  ) {
    return String(output.url());
  }

  return null;
}

export async function generatePixelArtImages(
  subjectContext: string
): Promise<GeneratedImage[]> {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const bedrockApiKey = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!bedrockApiKey) {
    throw new Error('AWS_BEARER_TOKEN_BEDROCK is not configured');
  }

  const awsRegion = process.env.AWS_REGION;
  if (!awsRegion) {
    throw new Error('AWS_REGION is not configured');
  }

  const replicate = new Replicate({ auth: replicateToken });
  const ai = new BedrockOpenAI({ apiKey: bedrockApiKey, awsRegion });
  const promptVariations = await Promise.all(
    Array.from({ length: 4 }, async (_, index) => {
      const response = await ai.responses.create({
        model: PROMPT_MODEL,
        reasoning: { effort: 'none' },
        input: `Create a different variation of this image generation prompt. Make it unique but keep the same core concept and style:

Subject Context:
${subjectContext}

Requirements for variation ${index + 1}:
- Keep the same pixel-art style and 3:2 aspect ratio
- Maintain the same core concept or idea
- Change the visual composition, colors, or perspective
- Make it distinctly different from the other variations
- Keep it professional and modern
- Avoid text or logos
- Focus on visual metaphor rather than literal representation

Generate only the new prompt text, with no explanations.`,
      });
      const generatedVariation = response.output_text.trim();

      if (!generatedVariation) {
        throw new Error('No prompt variation was generated');
      }

      return generatedVariation;
    })
  );

  return Promise.all(
    promptVariations.map(async prompt => {
      const output = await replicate.run(IMAGE_MODEL, {
        input: {
          prompt,
          aspect_ratio: '3:2',
          output_format: 'webp',
          output_quality: 90,
          seed: Math.floor(Math.random() * 10000),
        },
      });
      const imageUrl = getReplicateOutputUrl(output);
      if (!imageUrl) throw new Error('Image generation returned no URL');

      return { url: imageUrl, prompt };
    })
  );
}
