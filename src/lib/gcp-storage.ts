import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

function getBucket() {
  const encodedCredentials = process.env.GOOGLE_PRIVATE_KEY;
  if (!encodedCredentials) {
    throw new Error("Missing GOOGLE_PRIVATE_KEY");
  }

  const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
  if (!bucketName) {
    throw new Error("Missing GOOGLE_CLOUD_BUCKET");
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(
      Buffer.from(encodedCredentials, "base64").toString("utf8")
    );
  } catch {
    throw new Error("Invalid GOOGLE_PRIVATE_KEY");
  }

  const storage = new Storage({ credentials });
  const bucket = storage.bucket(bucketName);

  return {
    bucket,
    serviceAccount: credentials.client_email,
  };
}

export async function uploadToGCS(
  file: File,
  folder: string = "projects"
): Promise<{
  url: string;
  filename: string;
}> {
  let serviceAccount: string | undefined;
  try {
    console.log("Starting upload to GCS...");
    const { bucket, serviceAccount: email } = getBucket();
    serviceAccount = email;
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
      serviceAccount,
    });
    throw error;
  }
}

export async function deleteFromGCS(filename: string): Promise<void> {
  try {
    const { bucket } = getBucket();
    await bucket.file(filename).delete();
  } catch (error) {
    console.error("Error deleting from GCS:", error);
    throw error;
  }
}
