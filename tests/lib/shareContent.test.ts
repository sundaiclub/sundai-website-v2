// Mock @google/genai SDK
const generateContentMock = jest.fn();
jest.mock(
  '@google/genai',
  () => {
    return {
      __esModule: true,
      GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
          generateContent: generateContentMock,
        },
      })),
    };
  },
  { virtual: true }
);

import {
  buildShareContentPrompt,
  generateShareContent,
} from '../../src/lib/shareContent';

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
    process.env.GEMINI_API_KEY = 'test-api-key';
    // Reset default behavior
    generateContentMock.mockReset();
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
    it('should generate content using Gemini API successfully', async () => {
      generateContentMock.mockResolvedValueOnce({
        text: '🚀 We just built Amazing Project! Check out this incredible innovation #TechInnovation #Sundai',
      });

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

      expect(generateContentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          contents: expect.stringContaining('Amazing Project'),
        })
      );
    });

    it('propagates provider failures', async () => {
      const providerError = new Error('API Error');
      generateContentMock.mockRejectedValueOnce(providerError);

      await expect(
        generateShareContent({
          project: mockProject,
          platform: 'twitter',
          isTeamMember: true,
        })
      ).rejects.toBe(providerError);
    });

    it('rejects an empty provider response', async () => {
      generateContentMock.mockResolvedValueOnce({ text: '' });

      await expect(
        generateShareContent({
          project: mockProject,
          platform: 'twitter',
          isTeamMember: true,
        })
      ).rejects.toThrow('Gemini returned no share content.');
    });
  });
});
