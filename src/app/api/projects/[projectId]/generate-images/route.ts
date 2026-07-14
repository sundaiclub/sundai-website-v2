import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Replicate from "replicate";
import prisma from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const PROMPT_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "black-forest-labs/flux-2-klein-9b";

function getReplicateOutputUrl(output: unknown): string | null {
  if (Array.isArray(output)) {
    const first = output[0];

    if (!first) {
      return null;
    }

    if (typeof first === "string") {
      return first;
    }

    if (
      typeof first === "object" &&
      "url" in first &&
      typeof first.url === "function"
    ) {
      return String(first.url());
    }
  }

  if (typeof output === "string") {
    return output;
  }

  if (
    output !== null &&
    typeof output === "object" &&
    "url" in output &&
    typeof output.url === "function"
  ) {
    return String(output.url());
  }

  return null;
}

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

    const body: unknown = await req.json();
    const prompt =
      body !== null && typeof body === "object" && "prompt" in body
        ? body.prompt
        : undefined;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
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
Tech Stack: ${project.techTags.map((tag) => tag.name).join(', ')}
Domain: ${project.domainTags.map((tag) => tag.name).join(', ')}

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

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
      const resp = await ai.models.generateContent({
        model: PROMPT_MODEL,
        contents: variationPrompt
      });
      const generatedVariation = resp.text || '';
      
      if (!generatedVariation) {
        throw new Error('No prompt variation generated from Gemini API');
      }

      return generatedVariation.trim();
    };

    const promptVariations = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        generatePromptVariation(projectContext, index + 1)
      )
    );

    // Generate four images concurrently.
    const images = await Promise.all(
      promptVariations.map(async promptVariation => {
        const output = await replicate.run(IMAGE_MODEL, {
          input: {
            prompt: promptVariation,
            aspect_ratio: "16:9",
            output_format: "webp",
            output_quality: 90,
            seed: Math.floor(Math.random() * 10000)
          }
        });
        const imageUrl = getReplicateOutputUrl(output);

        if (!imageUrl) {
          throw new Error("Image generation returned no URL");
        }

        return { url: imageUrl, prompt: promptVariation };
      }
    ));

    return NextResponse.json({ images });
  } catch (error) {
    console.error("[GENERATE_IMAGES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
