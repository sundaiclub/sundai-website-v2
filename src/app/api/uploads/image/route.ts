import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image");
    
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { message: "No valid file provided" },
        { status: 400 }
      );
    }

    // Create a File-like object for uploadToGCS
    const fileData = {
      name: file.name || 'image.png',
      type: file.type || 'image/png',
      arrayBuffer: () => file.arrayBuffer(),
      size: file.size || 0
    };

    const uploadResult = await uploadToGCS(fileData as any);
    
    // Create image record in database
    const image = await prisma.image.create({
      data: {
        key: uploadResult.filename,
        bucket: process.env.GOOGLE_CLOUD_BUCKET!,
        url: uploadResult.url,
        filename: fileData.name,
        mimeType: fileData.type,
        size: fileData.size,
        width: undefined,
        height: undefined,
      },
    });

    return NextResponse.json({
      url: image.url,
      success: true
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Error uploading image" },
      { status: 500 }
    );
  }
} 