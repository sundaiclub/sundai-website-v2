const responsesCreateMock = jest.fn();

jest.mock('openai', () => ({
  BedrockOpenAI: jest.fn().mockImplementation(() => ({
    responses: { create: responsesCreateMock },
  })),
}));

import { BedrockOpenAI } from 'openai';
import {
  generateBedrockText,
  isBedrockTextConfigured,
  streamBedrockText,
} from '../../src/lib/bedrockText';

describe('bedrockText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_BEARER_TOKEN_BEDROCK = 'test-bedrock-key';
    process.env.AWS_REGION = 'us-east-2';
  });

  afterEach(() => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    delete process.env.AWS_REGION;
  });

  it('generates text with GPT-5.6 Luna', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output_text: 'Generated text',
    });

    await expect(generateBedrockText('Write a post')).resolves.toBe(
      'Generated text'
    );
    expect(BedrockOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-bedrock-key',
      awsRegion: 'us-east-2',
    });
    expect(responsesCreateMock).toHaveBeenCalledWith({
      model: 'openai.gpt-5.6-luna',
      reasoning: { effort: 'none' },
      input: 'Write a post',
    });
  });

  it('returns only output text delta events from a stream', async () => {
    async function* responseEvents() {
      yield { type: 'response.created' };
      yield { type: 'response.output_text.delta', delta: 'Hello ' };
      yield { type: 'response.output_text.delta', delta: 'world' };
      yield { type: 'response.completed' };
    }
    responsesCreateMock.mockResolvedValueOnce(responseEvents());

    const chunks: string[] = [];
    for await (const chunk of streamBedrockText('Write text')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello ', 'world']);
    expect(responsesCreateMock).toHaveBeenCalledWith({
      model: 'openai.gpt-5.6-luna',
      reasoning: { effort: 'none' },
      input: 'Write text',
      stream: true,
    });
  });

  it('reports whether both required variables are configured', () => {
    expect(isBedrockTextConfigured()).toBe(true);

    delete process.env.AWS_REGION;
    expect(isBedrockTextConfigured()).toBe(false);
  });

  it('requires a Bedrock API key', async () => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;

    await expect(generateBedrockText('Write text')).rejects.toThrow(
      'AWS_BEARER_TOKEN_BEDROCK is not configured'
    );
  });
});
