import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

// Validate environment variables
if (!process.env.GOOGLE_PRIVATE_KEY)
  throw new Error("Missing GOOGLE_PRIVATE_KEY");
if (!process.env.GOOGLE_CLOUD_BUCKET)
  throw new Error("Missing GOOGLE_CLOUD_BUCKET");

// Decode and parse the base64-encoded credentials
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_PRIVATE_KEY, "base64").toString()
);

// Initialize storage with credentials from environment variables
const storage = new Storage({
  credentials,
});
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET);

export async function uploadToGCS(
  file: File,
  folder: string = "projects"
): Promise<{
  url: string;
  filename: string;
}> {
  try {
    console.log("Starting upload to GCS...");
    const fileBuffer = await file.arrayBuffer();
    const filename = `${folder}/${uuidv4()}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;
    const blob = bucket.file(filename);

    console.log("Saving file to GCS...");
    await blob.save(Buffer.from(fileBuffer), {
      metadata: {
        contentType: file.type,
      },
    });

    console.log("File saved successfully");
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return {
      url: publicUrl,
      filename,
    };
  } catch (error) {
    console.error("Detailed upload error:", {
      error,
      bucket: process.env.GOOGLE_CLOUD_BUCKET,
      serviceAccount: credentials.client_email,
    });
    throw error;
  }
}

export async function deleteFromGCS(filename: string): Promise<void> {
  try {
    await bucket.file(filename).delete();
  } catch (error) {
    console.error("Error deleting from GCS:", error);
    throw error;
  }
}
