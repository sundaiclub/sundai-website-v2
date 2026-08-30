jest.mock('../../src/lib/bedrockText', () => ({
  BEDROCK_TEXT_MODEL: 'openai.gpt-5.6-luna',
  generateBedrockText: jest.fn(),
}));

import { generateBedrockText } from '../../src/lib/bedrockText';
import {
  buildShareContentPrompt,
  generateShareContent,
} from '../../src/lib/shareContent';

const generateBedrockTextMock = generateBedrockText as jest.MockedFunction<
  typeof generateBedrockText
>;

// Mock the Project type
const mockProject = {
  id: 'project-123',
  title: 'Amazing Project',
  preview: 'A brief description of the project',
  description:
    'A detailed description of the amazing project that does incredible things',
  demoUrl: 'https://demo.example.com',
  githubUrl: 'https://github.com/user/repo',
  blogUrl: 'https://blog.example.com',
  launchLead: {
    name: 'John Doe',
    twitterUrl: 'https://twitter.com/johndoe',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
  },
  participants: [
    {
      hacker: {
        name: 'Jane Smith',
        twitterUrl: 'https://twitter.com/janesmith',
        linkedinUrl: 'https://linkedin.com/in/janesmith',
      },
    },
  ],
};

describe('ShareContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateBedrockTextMock.mockReset();
  });

  describe('buildShareContentPrompt', () => {
    it('uses the project, platform limit, and real team handles', () => {
      const prompt = buildShareContentPrompt({
        project: mockProject,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(prompt).toContain('Project: Amazing Project');
      expect(prompt).toContain('Keep under 280 characters');
      expect(prompt).toContain(
        'Use the real social handles: @johndoe, @janesmith'
      );
      expect(prompt).toContain('Start with "We just built..."');
    });

    it('applies the non-team-member perspective consistently', () => {
      const prompt = buildShareContentPrompt({
        project: mockProject,
        platform: 'linkedin',
        isTeamMember: false,
      });

      expect(prompt).toContain('Write from third-person promoting Sundai');
      expect(prompt).toContain('Keep under 3000 characters');
      expect(prompt).toContain('@johndoe, @janesmith');
    });
  });

  describe('generateShareContent', () => {
    it('generates content with GPT-5.6 Luna on Bedrock', async () => {
      generateBedrockTextMock.mockResolvedValueOnce(
        '🚀 We just built Amazing Project! Check out this incredible innovation #TechInnovation #Sundai'
      );

      const result = await generateShareContent({
        project: mockProject,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result).toEqual({
        content:
          '🚀 We just built Amazing Project! Check out this incredible innovation #TechInnovation #Sundai',
        hashtags: ['TechInnovation', 'Sundai'],
        characterCount: 94,
      });

      expect(generateBedrockTextMock).toHaveBeenCalledWith(
        expect.stringContaining('Amazing Project')
      );
    });

    it('propagates provider failures', async () => {
      const providerError = new Error('API Error');
      generateBedrockTextMock.mockRejectedValueOnce(providerError);

      await expect(
        generateShareContent({
          project: mockProject,
          platform: 'twitter',
          isTeamMember: true,
        })
      ).rejects.toBe(providerError);
    });

    it('rejects an empty provider response', async () => {
      generateBedrockTextMock.mockResolvedValueOnce('');

      await expect(
        generateShareContent({
          project: mockProject,
          platform: 'twitter',
          isTeamMember: true,
        })
      ).rejects.toThrow('No share content was generated.');
    });
  });
});
