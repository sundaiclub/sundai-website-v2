import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
  };
}

function createDebugErrorResponse(
  status: number,
  message: string,
  error: unknown,
  context: Record<string, unknown>
) {
  const isDebugEnv =
    process.env.NODE_ENV === 'test' || process.env.CI === 'true';

  if (!isDebugEnv) {
    return new Response(message, { status });
  }

  return new Response(
    JSON.stringify({
      error: message,
      details: serializeError(error),
      context,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

async function handler(request: Request) {
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  const payload = await request.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(process.env.WEBHOOK_SECRET || '');

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  const eventType = evt.type;

  if (eventType === 'user.created') {
    const {
      id,
      email_addresses,
      primary_email_address_id,
      first_name,
      last_name,
      image_url,
      username,
    } = evt.data;
    try {
      const primaryEmail = email_addresses.find(
        email => email.id === primary_email_address_id
      );

      if (
        !primaryEmail ||
        primaryEmail.verification?.status !== 'verified' ||
        !primaryEmail.email_address.trim()
      ) {
        console.error(
          'Cannot create or link Hacker without a verified primary email',
          {
            eventType,
            clerkId: id,
            primaryEmailAddressId: primary_email_address_id,
          }
        );
        return new Response('Verified primary email required', { status: 422 });
      }

      const normalizedEmail = primaryEmail.email_address.trim().toLowerCase();
      const existingClerkHacker = await prisma.hacker.findUnique({
        where: { clerkId: id },
      });

      if (existingClerkHacker) {
        return new Response(JSON.stringify(existingClerkHacker), {
          status: 200,
        });
      }

      const emailMatches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Hacker"
        WHERE LOWER(BTRIM(email)) = ${normalizedEmail}
        ORDER BY "createdAt" ASC
        LIMIT 2
      `;

      if (emailMatches.length > 1) {
        console.warn(
          'Creating a new Hacker because the email matches multiple Hackers',
          {
            eventType,
            clerkId: id,
            hackerIds: emailMatches.map(hacker => hacker.id),
          }
        );
      }

      if (emailMatches.length === 1) {
        const linkedHacker = await prisma.hacker.update({
          where: { id: emailMatches[0].id },
          data: { clerkId: id },
        });

        return new Response(JSON.stringify(linkedHacker), { status: 200 });
      }

      const emailUsername = normalizedEmail.split('@')[0];
      const name =
        first_name && last_name
          ? `${first_name} ${last_name}`
          : first_name
            ? first_name
            : emailUsername;

      const hacker = await prisma.hacker.upsert({
        where: { clerkId: id },
        update: {
          name: name,
          email: normalizedEmail,
          username: username || emailUsername,
          ...(image_url && {
            avatar: {
              upsert: {
                create: {
                  key: `avatars/${id}`,
                  bucket: 'sundai-avatars',
                  url: image_url,
                  filename: `${id}-avatar`,
                  mimeType: 'image/jpeg',
                  size: 0,
                },
                update: {
                  url: image_url,
                },
              },
            },
          }),
        },
        create: {
          name: name,
          clerkId: id,
          email: normalizedEmail,
          username: username || emailUsername,
          role: 'HACKER',
          ...(image_url && {
            avatar: {
              create: {
                key: `avatars/${id}`,
                bucket: 'sundai-avatars',
                url: image_url,
                filename: `${id}-avatar`,
                mimeType: 'image/jpeg',
                size: 0,
              },
            },
          }),
        },
      });

      return new Response(JSON.stringify(hacker), { status: 201 });
    } catch (error) {
      console.error('Error creating hacker:', {
        eventType,
        clerkId: id,
        emailCount: email_addresses?.length ?? 0,
        hasImageUrl: Boolean(image_url),
        username,
        error: serializeError(error),
      });
      return createDebugErrorResponse(500, 'Error creating hacker', error, {
        eventType,
        clerkId: id,
        emailCount: email_addresses?.length ?? 0,
        hasImageUrl: Boolean(image_url),
        username,
      });
    }
  }

  return new Response('', { status: 200 });
}
export const GET = handler;
export const POST = handler;
export const PUT = handler;
