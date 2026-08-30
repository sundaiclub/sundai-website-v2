const replicateRunMock = jest.fn();

jest.mock('../../src/lib/bedrockText', () => ({
  BEDROCK_TEXT_MODEL: 'openai.gpt-5.6-luna',
  generateBedrockText: jest.fn(),
}));

jest.mock('replicate', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ run: replicateRunMock })),
}));

import Replicate from 'replicate';
import { generateBedrockText } from '../../src/lib/bedrockText';
import {
  generatePixelArtImages,
  PROMPT_MODEL,
} from '../../src/lib/aiImageGeneration';

const generateBedrockTextMock = generateBedrockText as jest.MockedFunction<
  typeof generateBedrockText
>;

describe('generatePixelArtImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REPLICATE_API_TOKEN = 'test-replicate-key';

    generateBedrockTextMock.mockImplementation(input =>
      Promise.resolve(`Generated: ${input}`)
    );
    replicateRunMock.mockResolvedValue(['https://example.com/image.webp']);
  });

  afterEach(() => {
    delete process.env.REPLICATE_API_TOKEN;
  });

  it('uses GPT-5.6 Luna through Amazon Bedrock for prompt variations', async () => {
    const images = await generatePixelArtImages('A friendly robot');

    expect(PROMPT_MODEL).toBe('openai.gpt-5.6-luna');
    expect(generateBedrockTextMock).toHaveBeenCalledTimes(4);
    expect(generateBedrockTextMock).toHaveBeenCalledWith(
      expect.stringContaining('A friendly robot')
    );
    expect(Replicate).toHaveBeenCalledWith({ auth: 'test-replicate-key' });
    expect(replicateRunMock).toHaveBeenCalledTimes(4);
    expect(images).toHaveLength(4);
  });

  it('propagates Bedrock failures', async () => {
    generateBedrockTextMock.mockRejectedValueOnce(new Error('Bedrock failed'));

    await expect(generatePixelArtImages('A robot')).rejects.toThrow(
      'Bedrock failed'
    );
  });
});
