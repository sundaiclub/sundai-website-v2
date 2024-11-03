import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function handler(request: Request) {
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    try {
      const emailUsername = email_addresses[0].email_address.split("@")[0];
      const name =
        first_name && last_name
          ? `${first_name} ${last_name}`
          : first_name
          ? first_name
          : emailUsername;

      const hacker = await prisma.hacker.create({
        data: {
          name: name,
          clerkId: id,
          email: email_addresses[0].email_address,
          role: "HACKER",
          ...(image_url && {
            avatar: {
              create: {
                key: `avatars/${id}`,
                bucket: "sundai-avatars",
                url: image_url,
                filename: `${id}-avatar`,
                mimeType: "image/jpeg",
                size: 0,
              },
            },
          }),
        },
      });

      return new Response(JSON.stringify(hacker), { status: 201 });
    } catch (error) {
      console.error("Error creating hacker:", error);
      return new Response("Error creating hacker", { status: 500 });
    }
  }

  return new Response("", { status: 200 });
}
export const GET = handler;
export const POST = handler;
export const PUT = handler;
