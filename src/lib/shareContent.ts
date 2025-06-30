import { Project } from "@/app/components/Project";

// Enhanced project type for share content with social URLs
export interface ProjectWithSocials extends Omit<Project, 'launchLead' | 'participants'> {
  launchLead: {
    id: string;
    name: string;
    twitterUrl?: string | null;
    linkedinUrl?: string | null;
    avatar?: {
      url: string;
    } | null;
  };
  participants: Array<{
    role: string;
    hacker: {
      id: string;
      name: string;
      bio?: string | null;
      twitterUrl?: string | null;
      linkedinUrl?: string | null;
      avatar?: {
        url: string;
      } | null;
    };
  }>;
}

export interface ShareContentRequest {
  project: ProjectWithSocials;
  userInfo: any;
  platform: 'twitter' | 'linkedin' | 'reddit';
  isTeamMember: boolean;
}

export interface ShareContentResponse {
  content: string;
  hashtags: string[];
  characterCount: number;
}

const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 3000,
  reddit: 40000,
};

const PLATFORM_STYLES = {
  twitter: "concise, engaging, with relevant emojis and hashtags",
  linkedin: "professional, detailed, focusing on technical achievements and team collaboration", 
  reddit: "informative, community-focused, with technical details that would interest developers",
};

// Platform-specific team tagging helper
function formatTeamNames(teamMembers: Array<{name: string, twitterUrl?: string | null, linkedinUrl?: string | null}>, platform: string): string {
  switch (platform) {
    case 'linkedin':
      return teamMembers.map(member => {
        if (member.linkedinUrl) {
          // Extract LinkedIn username from URL or use full URL
          const linkedinMatch = member.linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
          return linkedinMatch ? `@${linkedinMatch[1]}` : member.linkedinUrl;
        }
        // Fallback to name-based format
        return `@${member.name.toLowerCase().replace(/\s+/g, '-')}`;
      }).join(', ');
      
    case 'twitter':
      return teamMembers.map(member => {
        if (member.twitterUrl) {
          // Extract Twitter username from URL
          const twitterMatch = member.twitterUrl.match(/twitter\.com\/([^\/\?]+)|x\.com\/([^\/\?]+)/);
          const username = twitterMatch ? (twitterMatch[1] || twitterMatch[2]) : null;
          return username ? `@${username}` : `@${member.name.split(' ')[0].toLowerCase()}`;
        }
        // Fallback to name-based format
        return `@${member.name.split(' ')[0].toLowerCase()}`;
      }).join(', ');
      
    case 'reddit':
      return teamMembers.map(member => {
        // Reddit doesn't have direct social integration, use name-based
        return `u/${member.name.split(' ')[0].toLowerCase()}`;
      }).join(', ');
      
    default:
      return teamMembers.map(member => member.name).join(', ');
  }
}

export async function generateShareContent({
  project,
  userInfo,
  platform,
  isTeamMember,
}: ShareContentRequest): Promise<ShareContentResponse> {
  const teamMembers = [
    {
      name: project.launchLead.name,
      twitterUrl: project.launchLead.twitterUrl,
      linkedinUrl: project.launchLead.linkedinUrl,
    },
    ...project.participants.map(p => ({
      name: p.hacker.name,
      twitterUrl: p.hacker.twitterUrl,
      linkedinUrl: p.hacker.linkedinUrl,
    }))
  ];
  
  const teamNames = teamMembers.map(member => member.name);
  const formattedTeamNames = formatTeamNames(teamMembers, platform);
  const perspective = isTeamMember ? "first-person as a team member" : "third-person promoting Sundai";
  const characterLimit = PLATFORM_LIMITS[platform];
  const style = PLATFORM_STYLES[platform];

  const prompt = `Generate a viral social media post for ${platform} about this project:

Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description}
Team: ${teamNames.join(', ')}
Launch Lead: ${project.launchLead.name}

Platform-specific tagging for ${platform}:
${platform === 'linkedin' ? '- Tag people with @firstname-lastname format or real LinkedIn handles' : ''}
${platform === 'twitter' ? '- Tag people with @username format from their Twitter URLs' : ''}
${platform === 'reddit' ? '- Tag people with u/username format, avoid hashtags' : ''}
Formatted team tags: ${formattedTeamNames}

Links available:
${project.demoUrl ? `- Demo: ${project.demoUrl}` : ''}
${project.githubUrl ? `- GitHub: ${project.githubUrl}` : ''}
${project.blogUrl ? `- Blog: ${project.blogUrl}` : ''}

Write from ${perspective}. Style should be ${style}.

Requirements:
- ${isTeamMember ? 'Start with "We just built..." or similar first-person language' : 'Mention "The team at Sundai built..." to promote Sundai'}
- Keep under ${characterLimit} characters
- Include relevant emojis
- Use the formatted team tags: ${formattedTeamNames}
- ${platform === 'reddit' ? 'Avoid hashtags, use plain text' : 'Add appropriate hashtags'}
- Include team member names with proper platform formatting
- Mention the links
- Make it engaging and viral-worthy
- End with link to https://www.sundai.club/projects for more projects

Generate only the post content, no explanations.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!generatedContent) {
      throw new Error('No content generated from Gemini API');
    }

    // Extract hashtags from the content
    const hashtagMatches = generatedContent.match(/#[\w]+/g) || [];
    const hashtags = hashtagMatches.map((tag: string) => tag.replace('#', ''));

    return {
      content: generatedContent,
      hashtags,
      characterCount: generatedContent.length,
    };
  } catch (error) {
    console.error('Error generating content with Gemini:', error);
    
    // Fallback to template-based content if API fails
    return generateFallbackContent({ project, userInfo, platform, isTeamMember });
  }
}

function generateFallbackContent({
  project,
  userInfo,
  platform,
  isTeamMember,
}: ShareContentRequest): ShareContentResponse {
  const teamMembers = [
    {
      name: project.launchLead.name,
      twitterUrl: project.launchLead.twitterUrl,
      linkedinUrl: project.launchLead.linkedinUrl,
    },
    ...project.participants.map(p => ({
      name: p.hacker.name,
      twitterUrl: p.hacker.twitterUrl,
      linkedinUrl: p.hacker.linkedinUrl,
    }))
  ];

  const formattedTeamNames = formatTeamNames(teamMembers, platform);
  const intro = isTeamMember 
    ? `🚀 We just built ${project.title}!` 
    : `🚀 Check out ${project.title} built by the team at Sundai!`;

  const links = [
    project.demoUrl && `🔗 Demo: ${project.demoUrl}`,
    project.githubUrl && `💻 Code: ${project.githubUrl}`,
    `🌟 More projects: https://www.sundai.club/projects`
  ].filter(Boolean).join('\n');

  const hashtags = ['Sundai', 'TechProjects', 'Innovation', 'BuildInPublic'];
  const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');

  let content;
  switch (platform) {
    case 'twitter':
      content = `${intro}\n\n${project.preview}\n\nBuilt by: ${formattedTeamNames}\n\n${links}\n\n${hashtagString}`;
      break;
    case 'linkedin':
      content = `${intro}\n\n${project.preview}\n\nOur amazing team (${formattedTeamNames}) worked together to create something special. This project showcases the innovative spirit at Sundai.\n\n${links}\n\n${hashtagString} #TeamWork #Innovation`;
      break;
    case 'reddit':
      content = `${intro}\n\n${project.preview}\n\nTechnical Details:\n${project.description.substring(0, 500)}...\n\nTeam: ${formattedTeamNames}\n\n${links}\n\nCheck out more projects at https://www.sundai.club/projects`;
      break;
    default:
      content = `${intro}\n\n${project.preview}\n\nBuilt by: ${formattedTeamNames}\n\n${links}\n\n${hashtagString}`;
  }

  return {
    content,
    hashtags: platform === 'reddit' ? [] : hashtags,
    characterCount: content.length,
  };
}