import { Project } from "@/app/components/Project";

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

export async function generateShareContent({
  project,
  userInfo,
  platform,
  isTeamMember,
}: ShareContentRequest): Promise<ShareContentResponse> {
  const teamNames = [
    project.launchLead.name,
    ...project.participants.map(p => p.hacker.name)
  ];
  
  const perspective = isTeamMember ? "first-person as a team member" : "third-person promoting Sundai";
  const characterLimit = PLATFORM_LIMITS[platform];
  const style = PLATFORM_STYLES[platform];

  const prompt = `Generate a viral social media post for ${platform} about this project:

Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description}
Team: ${teamNames.join(', ')}
Launch Lead: ${project.launchLead.name}

Links available:
${project.demoUrl ? `- Demo: ${project.demoUrl}` : ''}
${project.githubUrl ? `- GitHub: ${project.githubUrl}` : ''}
${project.blogUrl ? `- Blog: ${project.blogUrl}` : ''}

Write from ${perspective}. Style should be ${style}.

Requirements:
- ${isTeamMember ? 'Start with "We just built..." or similar first-person language' : 'Mention "The team at Sundai built..." to promote Sundai'}
- Keep under ${characterLimit} characters
- Include relevant emojis
- Add appropriate hashtags
- Include team member names
- Mention the links
- Make it engaging and viral-worthy
- End with link to sundai.com for more projects

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
  const teamNames = [
    project.launchLead.name,
    ...project.participants.map(p => p.hacker.name)
  ].join(', ');

  const intro = isTeamMember 
    ? `🚀 We just built ${project.title}!` 
    : `🚀 Check out ${project.title} built by the team at Sundai!`;

  const links = [
    project.demoUrl && `🔗 Demo: ${project.demoUrl}`,
    project.githubUrl && `💻 Code: ${project.githubUrl}`,
    `🌟 More projects: https://sundai.com`
  ].filter(Boolean).join('\n');

  const hashtags = ['Sundai', 'TechProjects', 'Innovation', 'BuildInPublic'];
  const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');

  let content;
  switch (platform) {
    case 'twitter':
      content = `${intro}\n\n${project.preview}\n\nBuilt by: ${teamNames}\n\n${links}\n\n${hashtagString}`;
      break;
    case 'linkedin':
      content = `${intro}\n\n${project.preview}\n\nOur amazing team (${teamNames}) worked together to create something special. This project showcases the innovative spirit at Sundai.\n\n${links}\n\n${hashtagString} #TeamWork #Innovation`;
      break;
    case 'reddit':
      content = `${intro}\n\n${project.preview}\n\nTechnical Details:\n${project.description.substring(0, 500)}...\n\nTeam: ${teamNames}\n\n${links}\n\nCheck out more projects at sundai.com`;
      break;
    default:
      content = `${intro}\n\n${project.preview}\n\nBuilt by: ${teamNames}\n\n${links}\n\n${hashtagString}`;
  }

  return {
    content,
    hashtags,
    characterCount: content.length,
  };
} 