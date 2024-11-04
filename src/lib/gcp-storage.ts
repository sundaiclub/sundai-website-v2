import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

if (!process.env.GOOGLE_CLOUD_PROJECT_ID)
  throw new Error("Missing GOOGLE_CLOUD_PROJECT_ID");
if (!process.env.GOOGLE_CLOUD_PRIVATE_KEY)
  throw new Error("Missing GOOGLE_CLOUD_PRIVATE_KEY");
if (!process.env.GCP_SERVICE_ACCOUNT_EMAIL)
  throw new Error("Missing GCP_SERVICE_ACCOUNT_EMAIL");
if (!process.env.GOOGLE_CLOUD_BUCKET)
  throw new Error("Missing GOOGLE_CLOUD_BUCKET");

// Initialize storage with credentials from environment variables
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
    private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
    private_key: process.env
      .GOOGLE_CLOUD_PRIVATE_KEY!.split(String.raw`\n`)
      .join("\n"),
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
      process.env.GCP_SERVICE_ACCOUNT_EMAIL || ""
    )}`,
  },
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
    const fileBuffer = await file.arrayBuffer();
    const filename = `${folder}/${uuidv4()}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;
    const blob = bucket.file(filename);

    // Upload the file without ACL settings
    await blob.save(Buffer.from(fileBuffer), {
      metadata: {
        contentType: file.type,
      },
    });

    // Make the file publicly accessible using the bucket's uniform access

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return {
      url: publicUrl,
      filename,
    };
  } catch (error) {
    console.error("Error uploading to GCS:", error);
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
