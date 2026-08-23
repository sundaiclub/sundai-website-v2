import type { Project } from '@/types/project';
import { BEDROCK_TEXT_MODEL, generateBedrockText } from '@/lib/bedrockText';

export type SharePlatform = 'twitter' | 'linkedin' | 'reddit';

type ShareTeamMember = {
  name: string;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
};

type SharePromptRequest = Pick<
  ShareContentRequest,
  'project' | 'platform' | 'isTeamMember'
>;

export interface ShareContentRequest {
  project: Project;
  platform: SharePlatform;
  isTeamMember: boolean;
}

export interface ShareContentResponse {
  content: string;
  hashtags: string[];
  characterCount: number;
}

const PLATFORM_LIMITS: Record<SharePlatform, number> = {
  twitter: 280,
  linkedin: 3000,
  reddit: 40000,
};

const PLATFORM_STYLES: Record<SharePlatform, string> = {
  twitter: 'concise, engaging, with relevant emojis and hashtags',
  linkedin:
    'professional, detailed, focusing on technical achievements and team collaboration',
  reddit:
    'informative, community-focused, with technical details that would interest developers',
};

export const SHARE_CONTENT_MODEL = BEDROCK_TEXT_MODEL;

function formatTeamNames(
  teamMembers: ShareTeamMember[],
  platform: SharePlatform
): string {
  const getUsername = (person: ShareTeamMember, platform: SharePlatform) => {
    switch (platform) {
      case 'twitter':
        if (person.twitterUrl) {
          const match = person.twitterUrl.match(
            /(?:twitter\.com|x\.com)\/([^/?]+)/
          );
          return match
            ? `@${match[1]}`
            : `@${person.name.split(' ')[0].toLowerCase()}`;
        }
        return `@${person.name.split(' ')[0].toLowerCase()}`;

      case 'linkedin':
        if (person.linkedinUrl) {
          const match = person.linkedinUrl.match(/linkedin\.com\/in\/([^/?]+)/);
          return match
            ? `@${match[1]}`
            : `@${person.name.toLowerCase().replace(/\s+/g, '-')}`;
        }
        return `@${person.name.toLowerCase().replace(/\s+/g, '-')}`;

      case 'reddit':
        return `u/${person.name.split(' ')[0].toLowerCase()}`;

      default:
        return person.name;
    }
  };

  return teamMembers.map(person => getUsername(person, platform)).join(', ');
}

export function buildShareContentPrompt({
  project,
  platform,
  isTeamMember,
}: SharePromptRequest): string {
  const teamMembers = [
    project.launchLead,
    ...project.participants.map(participant => participant.hacker),
  ];
  const formattedTeamNames = formatTeamNames(teamMembers, platform);
  const perspective = isTeamMember
    ? 'first-person as a team member'
    : 'third-person promoting Sundai';
  const characterLimit = PLATFORM_LIMITS[platform];
  const style = PLATFORM_STYLES[platform];

  return `Generate a viral social media post for ${platform} about this project:

Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description}
Team: ${teamMembers.map(person => person.name).join(', ')}
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
}

export async function generateShareContent({
  project,
  platform,
  isTeamMember,
}: ShareContentRequest): Promise<ShareContentResponse> {
  const prompt = buildShareContentPrompt({ project, platform, isTeamMember });

  const generatedContent = await generateBedrockText(prompt);
  if (!generatedContent) {
    throw new Error('No share content was generated.');
  }

  const hashtagMatches = generatedContent.match(/#[\w]+/g) ?? [];
  return {
    content: generatedContent,
    hashtags: hashtagMatches.map(tag => tag.slice(1)),
    characterCount: generatedContent.length,
  };
}
