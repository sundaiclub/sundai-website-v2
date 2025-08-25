import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Replicate from "replicate";
import prisma from "@/lib/prisma";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("[GENERATE_IMAGES] REPLICATE_API_TOKEN not found in environment variables");
      return new NextResponse("Replicate API token not configured", { status: 500 });
    }

    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Get the project to access title and description
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: {
        title: true,
        preview: true,
        description: true,
        techTags: { select: { name: true } },
        domainTags: { select: { name: true } }
      }
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    // Create a comprehensive prompt from project data
    const projectContext = `Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description || project.preview}
Tech Stack: ${project.techTags.map((tag: any) => tag.name).join(', ')}
Domain: ${project.domainTags.map((tag: any) => tag.name).join(', ')}

User Request: ${prompt}`;

    // Generate 4 different variations of the prompt concurrently
    const generatePromptVariation = async (basePrompt: string, variation: number) => {
      const variationPrompt = `Create a different variation of this image generation prompt. Make it unique but keep the same core concept and style:

Project Context: ${projectContext}

Requirements for variation ${variation}:
- Keep the same pixel-art style and 16:9 aspect ratio
- Maintain the same core concept/idea
- Change the visual composition, colors, or perspective
- Make it distinctly different from the original
- Keep it professional and modern
- Avoid text or logos
- Focus on visual metaphor rather than literal representation

Generate only the new prompt text, no explanations.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: variationPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedVariation = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!generatedVariation) {
        throw new Error('No prompt variation generated from Gemini API');
      }

      return generatedVariation.trim();
    };

    // Generate 4 different prompts concurrently
    const promptVariationPromises = [];
    for (let i = 1; i <= 4; i++) {
      promptVariationPromises.push(
        generatePromptVariation(projectContext, i).catch(() => {
          // Fallback to a basic prompt if variation fails
          return `Pixel art thumbnail, 16:9 aspect ratio, vibrant colors, professional and modern style. Depict ${project.title} with visual elements representing ${project.techTags.map((tag: any) => tag.name).join(', ')} and ${project.domainTags.map((tag: any) => tag.name).join(', ')}. Focus on visual metaphor rather than literal representation.`;
        })
      );
    }

    const promptVariations = await Promise.all(promptVariationPromises);

    // Generate 4 images concurrently using qwen-image
    const imageGenerationPromises = promptVariations.map(async (promptVariation, index) => {
      try {
        const input = {
          prompt: promptVariation,
          guidance: 4,
          num_inference_steps: 30, // Reduced from 50 to speed up generation
          seed: Math.floor(Math.random() * 10000) // Random seed for additional variety
        };

        const output = await replicate.run("qwen/qwen-image", { input });
        
        // Extract URL from the output
        const imageUrl = Array.isArray(output) 
          ? (output[0] as any).url()
          : (output as any).url();
        
        return imageUrl;
      } catch (error) {
        console.error(`Error generating image ${index + 1}:`, error);
        return null; // Return null for failed generations
      }
    });

    const imageResults = await Promise.all(imageGenerationPromises);
    const imageUrls = imageResults.filter(url => url !== null); // Filter out failed generations

    return NextResponse.json({ images: imageUrls });
  } catch (error) {
    console.error("[GENERATE_IMAGES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
