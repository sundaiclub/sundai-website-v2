import { generateShareContent } from '../../src/lib/shareContent';

// Mock fetch
global.fetch = jest.fn();

// Mock the Project type
const mockProject = {
  id: 'project-123',
  title: 'Amazing Project',
  preview: 'A brief description of the project',
  description: 'A detailed description of the amazing project that does incredible things',
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
      }
    }
  ],
};

const mockUserInfo = {
  id: 'user-123',
  name: 'Test User',
};

describe('ShareContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });


  describe('generateShareContent', () => {
    it('should generate content using Gemini API successfully', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '🚀 We just built Amazing Project! Check out this incredible innovation #TechInnovation #Sundai'
                }
              ]
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result).toEqual({
        content: '🚀 We just built Amazing Project! Check out this incredible innovation #TechInnovation #Sundai',
        hashtags: ['TechInnovation', 'Sundai'],
        characterCount: 94,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('Amazing Project'),
        })
      );
    });

    it('should fallback to template content when API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result.content).toContain('🚀 We just built Amazing Project!');
      expect(result.content).toContain('Built by: @johndoe, @jane');
      expect(result.hashtags).toEqual(['Sundai', 'TechProjects', 'Innovation', 'BuildInPublic']);
    });

    it('should fallback when API returns no content', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: ''
                }
              ]
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result.content).toContain('🚀 We just built Amazing Project!');
    });

    it('should generate LinkedIn content with professional tone', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'linkedin',
        isTeamMember: false,
      });

      expect(result.content).toContain('🚀 Check out Amazing Project built by the team at Sundai!');
      expect(result.content).toContain('Our amazing team');
      expect(result.content).toContain('#TeamWork #Innovation');
    });

    it('should generate Reddit content without hashtags', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'reddit',
        isTeamMember: true,
      });

      expect(result.content).toContain('🚀 We just built Amazing Project!');
      expect(result.content).toContain('Technical Details:');
      expect(result.content).toContain('u/john, u/jane');
      expect(result.hashtags).toEqual([]);
    });

    it('should handle projects without optional URLs', async () => {
      const projectWithoutUrls = {
        ...mockProject,
        demoUrl: null,
        githubUrl: null,
        blogUrl: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const result = await generateShareContent({
        project: projectWithoutUrls,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result.content).toContain('📄 Project: https://www.sundai.club/projects/project-123');
      expect(result.content).not.toContain('Demo:');
      expect(result.content).not.toContain('Code:');
    });

    it('should handle API errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result.content).toContain('🚀 We just built Amazing Project!');
      expect(consoleSpy).toHaveBeenCalledWith('Error generating content with Gemini:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should generate different content for team members vs non-team members', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const teamMemberResult = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      const nonTeamMemberResult = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: false,
      });

      expect(teamMemberResult.content).toContain('We just built');
      expect(nonTeamMemberResult.content).toContain('Check out');
      expect(nonTeamMemberResult.content).toContain('team at Sundai');
    });

    it('should include all available links in the content', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'API Error',
      });

      const result = await generateShareContent({
        project: mockProject,
        userInfo: mockUserInfo,
        platform: 'twitter',
        isTeamMember: true,
      });

      expect(result.content).toContain('🔗 Demo: https://demo.example.com');
      expect(result.content).toContain('💻 Code: https://github.com/user/repo');
      expect(result.content).toContain('📄 Project: https://www.sundai.club/projects/project-123');
      expect(result.content).toContain('🌟 More projects: https://www.sundai.club/projects');
    });
  });
});
