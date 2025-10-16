import { Project } from "@/app/components/Project";
import { GoogleGenAI } from "@google/genai";

export interface ShareContentRequest {
  project: Project;
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
function formatTeamNames(teamMembers: any[], platform: string): string {
  const getUsername = (person: any, platform: string) => {
    switch (platform) {
      case 'twitter':
        if (person.twitterUrl) {
          // Extract username from Twitter URL (twitter.com/username or x.com/username)
          const match = person.twitterUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
          return match ? `@${match[1]}` : `@${person.name.split(' ')[0].toLowerCase()}`;
        }
        return `@${person.name.split(' ')[0].toLowerCase()}`;
      
      case 'linkedin':
        if (person.linkedinUrl) {
          // Extract username from LinkedIn URL (linkedin.com/in/username)
          const match = person.linkedinUrl.match(/linkedin\.com\/in\/([^/?]+)/);
          return match ? `@${match[1]}` : `@${person.name.toLowerCase().replace(/\s+/g, '-')}`;
        }
        return `@${person.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      case 'reddit':
        // Reddit doesn't have URLs in our schema, use name-based format
        return `u/${person.name.split(' ')[0].toLowerCase()}`;
      
      default:
        return person.name;
    }
  };

  return teamMembers.map(person => getUsername(person, platform)).join(', ');
}

export async function generateShareContent({
  project,
  userInfo,
  platform,
  isTeamMember,
}: ShareContentRequest): Promise<ShareContentResponse> {
  const teamMembers = [
    project.launchLead,
    ...project.participants.map(p => p.hacker)
  ];
  
  const formattedTeamNames = formatTeamNames(teamMembers, platform);
  const perspective = isTeamMember ? "first-person as a team member" : "third-person promoting Sundai";
  const characterLimit = PLATFORM_LIMITS[platform];
  const style = PLATFORM_STYLES[platform];

  const prompt = `Generate a viral social media post for ${platform} about this project:

Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description}
Team: ${teamMembers.map(p => p.name).join(', ')}
Launch Lead: ${project.launchLead.name}

Platform-specific tagging for ${platform}:
${platform === 'linkedin' ? '- Tag people with their actual @username from LinkedIn profiles' : ''}
${platform === 'twitter' ? '- Tag people with their actual @username from Twitter profiles' : ''}
${platform === 'reddit' ? '- Tag people with u/username format, avoid hashtags' : ''}
Formatted team tags (with real social handles): ${formattedTeamNames}

Links available:
${project.demoUrl ? `- Demo: ${project.demoUrl}` : ''}
${project.githubUrl ? `- GitHub: ${project.githubUrl}` : ''}
${project.blogUrl ? `- Blog: ${project.blogUrl}` : ''}
- Project Page: https://www.sundai.club/projects/${project.id}

Write from ${perspective}. Style should be ${style}.

Requirements:
- ${isTeamMember ? 'Start with "We just built..." or similar first-person language' : 'Mention "The team at Sundai built..." to promote Sundai'}
- Keep under ${characterLimit} characters
- Include relevant emojis
- Use the real social handles: ${formattedTeamNames}
- ${platform === 'reddit' ? 'Avoid hashtags, use plain text' : 'Add appropriate hashtags'}
- Include team member names with their actual social handles when available
- Mention the links including the project page
- Make it engaging and viral-worthy
- End with link to https://www.sundai.club/projects for more projects

Avoid fluff, keep it concise, professional and to the point.
Avoid emojis.
Generate only the post content, no explanations.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
    const response: any = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const generatedContent: string = (response && (response.text as any)) || '';

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
    project.launchLead,
    ...project.participants.map(p => p.hacker)
  ];

  const formattedTeamNames = formatTeamNames(teamMembers, platform);
  const intro = isTeamMember 
    ? `🚀 We just built ${project.title}!` 
    : `🚀 Check out ${project.title} built by the team at Sundai!`;

  const links = [
    project.demoUrl && `🔗 Demo: ${project.demoUrl}`,
    project.githubUrl && `💻 Code: ${project.githubUrl}`,
    `📄 Project: https://www.sundai.club/projects/${project.id}`,
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