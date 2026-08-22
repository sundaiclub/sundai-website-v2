const responsesCreateMock = jest.fn();
const replicateRunMock = jest.fn();

jest.mock('openai', () => ({
  BedrockOpenAI: jest.fn().mockImplementation(() => ({
    responses: { create: responsesCreateMock },
  })),
}));

jest.mock('replicate', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ run: replicateRunMock })),
}));

import { BedrockOpenAI } from 'openai';
import Replicate from 'replicate';
import {
  generatePixelArtImages,
  PROMPT_MODEL,
} from '../../src/lib/aiImageGeneration';

describe('generatePixelArtImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_BEARER_TOKEN_BEDROCK = 'test-bedrock-key';
    process.env.AWS_REGION = 'us-east-2';
    process.env.REPLICATE_API_TOKEN = 'test-replicate-key';

    responsesCreateMock.mockImplementation(({ input }) =>
      Promise.resolve({ output_text: `Generated: ${input}` })
    );
    replicateRunMock.mockResolvedValue(['https://example.com/image.webp']);
  });

  afterEach(() => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    delete process.env.AWS_REGION;
    delete process.env.REPLICATE_API_TOKEN;
  });

  it('uses GPT-5.6 Luna through Amazon Bedrock for prompt variations', async () => {
    const images = await generatePixelArtImages('A friendly robot');

    expect(PROMPT_MODEL).toBe('openai.gpt-5.6-luna');
    expect(BedrockOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-bedrock-key',
      awsRegion: 'us-east-2',
    });
    expect(responsesCreateMock).toHaveBeenCalledTimes(4);
    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai.gpt-5.6-luna',
        reasoning: { effort: 'none' },
        input: expect.stringContaining('A friendly robot'),
      })
    );
    expect(Replicate).toHaveBeenCalledWith({ auth: 'test-replicate-key' });
    expect(replicateRunMock).toHaveBeenCalledTimes(4);
    expect(images).toHaveLength(4);
  });

  it('requires a Bedrock API key', async () => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;

    await expect(generatePixelArtImages('A robot')).rejects.toThrow(
      'AWS_BEARER_TOKEN_BEDROCK is not configured'
    );
  });

  it('requires an AWS region', async () => {
    delete process.env.AWS_REGION;

    await expect(generatePixelArtImages('A robot')).rejects.toThrow(
      'AWS_REGION is not configured'
    );
  });
});
