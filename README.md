# 🚀 Sundai Club!

This is the code for sundai.club platform.

## 📝 Contributing

Want to contribute? Check out our [GitHub Issues](https://github.com/sundaiclub/sundai-website-v2/issues) for ways to help! Look for issues labeled `good first issue` or `help wanted` to get started.

Reach out to @godeva or @arteml0178 on discord with any quesions.

## 📋 Table of Contents

- [🚀 Quick Start Guide for First-Time Setup](#-quick-start-guide-for-first-time-setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Start Docker Desktop](#2-start-docker-desktop)
  - [3. Environment Setup](#3-environment-setup)
  - [4. Database Setup](#4-database-setup)
  - [5. Start Development Server](#5-start-development-server)
- [🧪 Testing](#-testing)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [🔧 Troubleshooting](#-troubleshooting)
- [📖 Feature Documentation](#-feature-documentation)
- [🛠️ Organizer Event Workspace Operations](#️-organizer-event-workspace-operations)
- [🔑 Required External Services Setup](#-required-external-services-setup)
- [🚀 Learn More](#-learn-more)

## 🚀 Quick Start Guide for First-Time Setup

### Prerequisites

Before starting, ensure you have:

- **Node.js 24.x** and npm installed
- **Docker Desktop** installed AND running (not just installed!)
- **Git** for version control
- **Clerk Account** - Sign up at [clerk.com](https://clerk.com) for authentication
- **Google Cloud Project** - For file storage (optional for local development)

### 1. Clone & Install Dependencies

```bash
git clone [your-repo-url]
cd sundai-website-v2
# If you use nvm, install and select the version from .nvmrc.
nvm install
nvm use
npm ci
```

Use Node.js 24.x for development, tests, and deployment. `package.json` sets
`engines.node` to `24.x`, and `.npmrc` rejects installs with other Node.js major
versions. All GitHub Actions jobs read the version from `package.json`.

For Vercel, set **Settings → Build and Deployment → Node.js Version** to
**24.x**. The `engines.node` value overrides that setting for new deployments.
Deploy the change to Preview, check the app, then deploy to Production. Confirm
Node.js 24 in the deployment build logs. Existing deployments keep their runtime
until you deploy again. Vercel manages minor and patch updates within 24.x.

### 2. Start Docker Desktop

⚠️ **Critical Step**: Docker Desktop must be running before proceeding!

```bash
# On macOS - open Docker Desktop
open -a Docker

# On Windows - start Docker Desktop from Start menu
# On Linux - start docker service
sudo systemctl start docker

# Verify Docker is running
docker info
```

### 3. Environment Setup

#### Required Third-Party Services:

**Clerk Authentication** (Required):
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Get your publishable key and secret key from the dashboard

After setting up Clerk authentication, you'll need to add yourself to the database so your profile works correctly.
Once you've signed up with Clerk, you need to get your actual Clerk User ID:

Edit `prisma/seed.ts` and add yourself to the users array:

```typescript
// Add this to the users array in prisma/seed.ts
prisma.hacker.create({
  data: {
    name: "Your Full Name",           // Replace with your name
    clerkId: "user_your_clerk_id",    // Replace with your actual Clerk ID from Step 1
    role: Role.ADMIN,                 // or Role.HACKER
    bio: "New developer on the team",
    email: "your.email@example.com",  // Replace with your email
  },
}),
```

If you already ran migrations/seed beforehand, please do the following (otherwise skip this step):

```bash
# Reset and reseed the database with your profile included
npm run db:reset
```

**Now your profile should work!** Visit `/me` or click on your profile to see your hacker profile page.


**Google Cloud Storage** (Optional for local development):
1. Create Google Cloud Project
2. Enable Cloud Storage API
3. Create a storage bucket
4. Set up service account with storage permissions

#### Create `.env.local` file:

```bash
# Database (for local development)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sundai_db"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sundai_db"

# Clerk Authentication - GET THESE FROM YOUR CLERK DASHBOARD
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_actual_key_here"
CLERK_SECRET_KEY="sk_test_your_actual_secret_here"
WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Google Cloud Storage (optional for local development)
GOOGLE_CLOUD_BUCKET="your-bucket-name"

# Amazon Bedrock text generation and AI image generation
AWS_REGION="us-east-2"
AWS_BEARER_TOKEN_BEDROCK="your_bedrock_api_key_here"
REPLICATE_API_TOKEN="your_replicate_api_token_here"

# PostHog Analytics (optional for local development)
NEXT_PUBLIC_POSTHOG_KEY="your_posthog_key"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

For local Docker development, `DATABASE_URL` and `DIRECT_URL` can be the same value.

### 4. Database Setup

```bash
# Start PostgreSQL database container
npm run db:up

# Populate database (generate client, apply migrations, seed)
npm run db:populate

# Optionally verify database container
docker compose ps postgres
```

Common DB tasks during development:

```bash
# Create/apply a new migration from schema changes (interactive)
npm run db:migrate

# Reset DB and reseed (drops data!)
npm run db:reset
```

### Vercel + Amazon RDS

Use the limited application login for Vercel runtime traffic. Use the database-owner login only for the automatic migration step during a Vercel build:

```bash
# Runtime queries from Vercel / Prisma Client. Use the environment-specific app user.
DATABASE_URL="postgresql://APP_USER:PASSWORD@RDS_HOST:5432/DB_NAME?sslmode=require&connection_limit=1&pool_timeout=10"

# Automatic Vercel migration command. Use the environment-specific owner user.
DIRECT_URL="postgresql://OWNER_USER:PASSWORD@RDS_HOST:5432/DB_NAME?sslmode=require"
```

Notes:

- Both URLs use the RDS PostgreSQL port `5432` and require TLS.
- Vercel must receive the limited application connection as `DATABASE_URL` and the matching owner connection as the sensitive `DIRECT_URL`.
- `vercel-build` uses `DIRECT_URL` only for `prisma migrate deploy`. The application build and runtime continue to use `DATABASE_URL`.
- Keep `connection_limit=1` for the current low-volume Vercel deployment. Review this limit and add a managed pooler if concurrency increases.

### 5. Start Development Server

```bash
npm run dev
```

🎉 **Success!** Visit [http://localhost:3001](http://localhost:3001) to see the application!

### 6. Clerk Webhook Setup (Required for Auth)

Clerk uses a webhook to sync new users to the database. When someone signs up, Clerk sends a `user.created` event to `/api/webhooks/clerk`, which creates their profile in the database. Since Clerk's servers need to reach your local machine, you need a reverse proxy to expose your local dev server to the internet.

**Using ngrok:**

1. Install ngrok from [ngrok.com](https://ngrok.com) and authenticate
2. Start your dev server (`npm run dev`)
3. In a separate terminal, expose your local server:
   ```bash
   ngrok http 3001
   ```
4. Copy the generated forwarding URL (e.g. `https://abc123.ngrok-free.app`)
5. In your [Clerk Dashboard](https://dashboard.clerk.com), go to **Webhooks** and add a new endpoint:
   - **URL**: `https://abc123.ngrok-free.app/api/webhooks/clerk`
   - **Events**: Subscribe to `user.created`
6. Copy the **Signing Secret** from the webhook endpoint and add it to your `.env.local`:
   ```bash
   WEBHOOK_SECRET="whsec_your_signing_secret_here"
   ```

> **Note:** The ngrok URL changes every time you restart it (on the free plan), so you'll need to update the webhook URL in the Clerk dashboard each time. Alternatively, you can use a paid ngrok plan for a stable subdomain, or another tunnel tool like [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or [localtunnel](https://theboroer.github.io/localtunnel-www/).

Without this setup, new user sign-ups won't create a profile in your local database, and you'll need to manually add users via the seed file instead.

## 🧪 Testing

This project includes comprehensive testing with Jest, React Testing Library, and automated pre-commit hooks.
Tests mock Prisma (the database) and external services, so Postgres is not required to run tests locally.

### Quick Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci

# Setup pre-commit hooks
npm run setup-husky
```

### Test Coverage

- **Components**: All React components are tested
- **Pages**: All page components are tested  
- **API Routes**: All API endpoints are tested
- **Utilities**: All utility functions are tested

### Pre-commit Hooks

Before each commit, the following runs automatically:
1. **ESLint** - Code linting and fixing
2. **Jest** - Related tests only
3. **Prettier** - Code formatting
4. **Build** - Next.js build verification

### GitHub Actions

All pull requests automatically run:
- Linting and type checking
- Full test suite
- Build verification
- Security audits

For detailed testing information, see [TESTING.md](./TESTING.md).

## 🏗️ Architecture Overview

```mermaid
graph TD
    A[Next.js Frontend] --> B[API Routes]
    B --> C[Prisma ORM]
    C --> D[PostgreSQL Database]
    B --> E[Clerk Authentication]
    B --> F[Google Cloud Storage]
    A --> H[PostHog Analytics]
```

**Tech Stack:**
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL with Docker for local development
- **Authentication**: Clerk for user management
- **File Storage**: Google Cloud Storage for images
- **Analytics**: PostHog for user tracking

## 🔧 Troubleshooting

### Common First-Time Setup Issues:

#### "Docker daemon not running"
```bash
# Solution: Start Docker Desktop first
open -a Docker  # macOS
# Wait for Docker Desktop to fully start (check system tray), then retry
```

#### "Environment variable not found: DATABASE_URL"
```bash
# Solution: Ensure .env.local file exists with correct variables
cat .env.local  # Check if file exists and has DATABASE_URL
```

#### "Database connection failed"
```bash
# Solution: Ensure PostgreSQL container is running
docker compose ps
# If not running:
npm run db:up
```

#### "Clerk authentication errors"
```bash
# Solution: Get real API keys from Clerk dashboard
# 1. Go to https://clerk.com
# 2. Create new application
# 3. Copy ACTUAL API keys (not placeholder text) to .env.local
```

#### "Missing CLERK_ENCRYPTION_KEY" warning
```bash
# This is a deprecation warning, app will still work
# Add to .env.local if you want to remove the warning:
CLERK_ENCRYPTION_KEY="your_encryption_key_from_clerk_dashboard"
```

### Development Commands:

```bash
# Database management
npm run db:up                 # Start database
npm run db:down               # Stop database
docker compose logs -f postgres # View database logs

# Database reset (careful!)
npm run db:reset
npm run db:populate

# Database backup/restore
npm run db:backup
npm run db:restore ./.data/backups/<backup>.sql.gz

# Note: backups use DATABASE_URL from your .env file.
# Ensure .env contains a valid DATABASE_URL (same as in .env.local typically).

# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run linting

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:ci      # Run tests for CI
npm run setup-husky  # Setup pre-commit hooks
```

## 🛠️ Organizer Event Workspace Operations

The organizer workspace supports private event materials and consent-aware event
email/SMS. These integrations are optional for local development: unavailable
providers are shown as unavailable in the workspace instead of making unrelated
event operations fail.

### Private event material storage

Event material files use a dedicated private Google Cloud Storage bucket. They
must not be stored in the public image bucket or made publicly readable. Browsers
upload through a short-lived signed PUT URL, and downloads always pass through an
authorization endpoint before receiving a short-lived signed GET URL.

Configure:

```bash
# Base64-encoded Google service-account JSON used by the existing GCS adapter
GOOGLE_PRIVATE_KEY="base64-encoded-service-account-json"

# Existing public/image storage, when those features are used
GOOGLE_CLOUD_BUCKET="public-image-bucket"

# Dedicated private bucket for organizer event materials
GOOGLE_CLOUD_MATERIALS_BUCKET="private-event-materials"
```

The service account needs permission to create, inspect, read, and delete objects
and to sign URLs in `GOOGLE_CLOUD_MATERIALS_BUCKET`. Keep public access prevention
enabled on that bucket. If browser uploads originate from a different domain,
configure bucket CORS for the application origins and the signed `PUT` method.
Do not persist signed URLs: upload intents expire after 15 minutes and authorized
download URLs expire after 5 minutes.

Material uploads are limited to 25 MiB and the passive-file allowlist displayed
in the organizer UI. A finalized upload is metadata-checked before its database
record is created. Storage/provider errors should therefore be investigated in
application logs and bucket IAM/CORS configuration; making the bucket public is
not a valid workaround.

### Email and SMS provider availability

Event email is available only when both variables are present:

```bash
AWS_REGION="us-east-1"
AWS_SES_FROM_EMAIL="Sundai Events <events@sundai.club>"
```

AWS credentials are loaded through the standard AWS SDK credential provider
chain. The configured identity/domain must be verified in SES and permitted to
send in the selected region.

All application email sends use Vercel Queues and one SES delivery adapter.
This includes event blasts, registration decisions, weekly editions, and test
emails. Templates remain in their feature modules. The worker sends batches
of up to 10 messages, with a shared database rate limit of one batch per second
per SES region. The SES client reuses connections and attempts each email once.
The request returns after queue publication; the mailing can exceed the
worker function's 60-second allowance because each batch is a separate call.

Apply the email queue migration before deploying this cutover. See
[Email queue](docs/email-queue.md) for deployment, failure recovery, and local
verification. No existing failed or interrupted sends are automatically replayed.

Event SMS requires the complete Twilio configuration:

```bash
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_MESSAGING_SERVICE_SID="MG..."
TWILIO_WEBHOOK_BASE_URL="https://www.sundai.club"
```

The Messaging Service must have an SMS-capable sender. Missing any SES setting
disables email; missing any Twilio setting disables SMS. Delivery is recorded per
recipient, so a partial provider failure remains visible without rewriting
successful outcomes or registration status. Provider errors returned to the UI
are sanitized; use provider dashboards and server logs for operational diagnosis.

Configure the Twilio Messaging Service to use these HTTPS endpoints with `POST`:

```text
Incoming messages: https://www.sundai.club/api/webhooks/twilio/incoming
Delivery status:   https://www.sundai.club/api/webhooks/twilio/status
```

Enable Advanced Opt-Out on the Messaging Service and keep incoming keyword
messages enabled. Twilio sends `OptOutType` for STOP, HELP, and START. Twilio
already sends the configured keyword reply, so the application records the event
and returns empty TwiML. STOP clears the matching user's site and chapter SMS
consent. START does not restore consent; the user must use the approved site
consent flow again. `TWILIO_WEBHOOK_BASE_URL` must exactly match the public origin
that is configured in Twilio because the application validates every Twilio
request signature.

The application also adds the delivery status URL to each new outbound SMS API
request. Delivery callbacks update recipient states and the site-admin
communications report at `/admin/communications`. Existing messages that were
sent before this setup do not receive historical delivery callbacks.

### Versioned SMS consent

Twilio configuration alone does not enable an SMS recipient. SMS also requires
approved consent copy/version configuration and an active chapter membership with
SMS enabled, a usable E.164 phone number, and consent captured for the current
version.

Configure one public version and copy. The browser displays these values, and
the server uses the same values to record and validate consent:

```bash
NEXT_PUBLIC_SMS_CONSENT_VERSION="2026-07-10"
NEXT_PUBLIC_SMS_CONSENT_COPY="Approved consent language shown before opt-in"
```

These values are not secrets. Next.js includes them in the browser build, so a
change requires a new build and deployment. Change the version whenever the
approved copy changes. Existing consent is deliberately ineligible after a
version change until the member explicitly opts in to the new version. If either
value is missing, SMS consent capture and recipient eligibility are disabled.
Clearing SMS preferences also clears the stored consent evidence.

Phone numbers are stored and sent in E.164 format. A 10-digit US number without
a country prefix defaults to `+1`; for example, `5086485700` becomes
`+15086485700`. Other international numbers must include their `+` country code.

### Operational validation

After changing workspace infrastructure or provider configuration:

```bash
npx prisma validate
npx prisma generate
npm run test -- --runInBand tests/lib/eventMaterials.test.ts
npm run test -- --runInBand tests/lib/eventCommunications.test.ts
npm run test -- --runInBand tests/lib/eventDelivery.test.ts
npm run build
```

For a deployment smoke test, verify that an organizer can create and download a
private test material, that unavailable channels are correctly labeled, and that
an eligible test recipient can be previewed before sending. Never use production
audiences for provider smoke tests. Audience changes between preview and send
must return a reconfirmation step, and restricted material URLs must fail after
their short expiry or when current access is removed.

## 🔑 Required External Services Setup

### Clerk Authentication Setup:
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your publishable key and secret key to `.env.local`
4. Add webhook endpoint for user sync: `[your-domain]/api/webhooks/clerk`
5. Configure sign-in/sign-up flows in Clerk dashboard

### Google Cloud Storage Setup (Private Event Materials):
1. Create Google Cloud Project
2. Enable Cloud Storage API
3. Create a private storage bucket for event materials
4. Give the service account access to that private bucket
5. Set `GOOGLE_CLOUD_MATERIALS_BUCKET` and the base64 service-account JSON in `GOOGLE_PRIVATE_KEY`

Public images use S3 and CloudFront. See the public image cutover procedure below.

### AI Image Generation Setup (Optional):
1. In Amazon Bedrock, enable access to `openai.gpt-5.6-luna` in a supported region.
2. Create a Bedrock API key for the application.
3. Set `AWS_REGION` and `AWS_BEARER_TOKEN_BEDROCK` in `.env.local`.
4. **Replicate API**: Sign up at [replicate.com](https://replicate.com) and get your API token.
5. Set `REPLICATE_API_TOKEN` in `.env.local`.
6. The AI image generation feature will be available in project editing for creating pixel-art thumbnails.

The same Bedrock configuration generates project share posts and rewrites news email content.

## 🚀 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Prisma Documentation](https://www.prisma.io/docs) - Database ORM and migrations
- [Clerk Documentation](https://clerk.com/docs) - Authentication and user management
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS framework

---

Built with ❤️ by the Sundai Club team

## Public image cutover to S3

Public project, chapter, event and avatar images use the private S3 bucket
`sundai-images-426771917681` in `us-east-1`. CloudFront serves them from
`https://d10whcg56p8om0.cloudfront.net`. Private event materials still use the
private GCP materials bucket.

Set the four `S3_IMAGE_*` values shown in `.env.example`. Vercel uploads use the
`sundai-images-production` role through Vercel OIDC. They do not use the static
credentials used for SES. Local uploads use the AWS SDK credential chain. The
copy and database tools use the AWS CLI profile selected by `AWS_PROFILE`, or
`default`. The production role has upload access only. Use the operator's AWS
profile for migration checks, which require S3 read access as well.

The bucket, CloudFront distribution, OIDC provider and production variables
were set up before this code cutover. The first copy contained 2,533 objects.
The local manifest is `.data/image-migration/manifest.json`. It is not committed.
Run the copy tool again to create a fresh manifest on another computer.

Use Node 24 for these commands. Do not use the normal development database
backup command for this procedure: it reads the local `.env` file.

1. Install the code and check it:

   ```sh
   npm ci
   npm test -- --runInBand tests/lib/s3-images.test.ts tests/lib/imageMigration.test.ts tests/api/uploads.test.ts tests/api/event-image.test.ts tests/api/avatar-image.test.ts tests/api/chapters.test.ts tests/api/projects-projectId-edit.test.ts tests/api/projects.test.ts tests/components/MarkdownEditor.test.tsx
   npm run lint
   npm run build
   ```

2. Prepare `.data/image-cutover.env` from the production database secret
   `sundai/prod/database-owner` in AWS Secrets Manager, plus the three S3
   configuration values below. Set file permissions to `600`. The database
   secret contains the host, port, database, user, password and SSL mode. Use
   those fields to construct `DIRECT_URL`; do not print credentials or commit
   this local file. The workspace drive does not enforce Unix permissions.
   Store the connection file and backup in an owner-only home directory and
   link them from `.data/`. The prepared files use the protected folder
   `/home/andrew/.cache/sundai-image-migration/2026-10-06/`; keep that folder
   until the cutover is accepted.

   ```text
   DIRECT_URL=<production connection from AWS Secrets Manager>
   S3_IMAGE_BUCKET=sundai-images-426771917681
   S3_IMAGE_REGION=us-east-1
   S3_IMAGE_PUBLIC_BASE_URL=https://d10whcg56p8om0.cloudfront.net
   ```

   The application's production OIDC role is already configured in Vercel.
   Set `AWS_PROFILE` if the operator credentials use a named profile. The
   manual tools use that profile, rather than the application's SES credentials.
   Your computer must be able to connect to the production database.

3. Save a full local production database backup in `.data/backups/`. Use
   PostgreSQL custom format and check that `pg_restore` can decode the archive.
   Record row counts and content hashes before the dry run, then run:

   ```sh
   node --env-file=.data/image-cutover.env scripts/migrate-images-to-s3.ts
   ```

   Review `.data/image-migration/db-dry-run.json`, especially the database host,
   proposed changes, unresolved links and S3 verification errors. Compare
   database counts and hashes after the dry run: they must be unchanged.
   This command reads the database and S3; it does not change production records.

4. When ready to apply the cutover, copy final source changes and repeat the
   dry run:

   ```sh
   node --env-file=.data/image-cutover.env scripts/copy-images-to-s3.ts
   node --env-file=.data/image-cutover.env scripts/migrate-images-to-s3.ts
   ```

   The copy command preserves MIME type and metadata. It checks MD5 hashes and
   stops if GCP changes during the copy. It does not delete objects. The database
   tool checks each referenced S3 object. Resolve report errors before apply.
   No maintenance window or database freeze is required for this inactive-app
   run. If the checks show new writes, inspect them before continuing.

5. Apply the data migration manually on the operator's computer, then check:

   ```sh
   node --env-file=.data/image-cutover.env scripts/migrate-images-to-s3.ts --apply
   node --env-file=.data/image-cutover.env scripts/migrate-images-to-s3.ts
   ```

   The change runs in one transaction. It keeps Image IDs and keys, sets the S3
   bucket and CloudFront URL, and changes embedded links in mutable strings
   and JSON, including Markdown descriptions. It rolls back if a selected
   field changes during the update. Check unchanged row counts and the expected
   field changes. The second dry run must report zero remaining changes, no
   unresolved links and no verification errors. Historical audit records,
   revisions, submitted form snapshots and sent mail stay unchanged.

6. Push the approved code to `main` through the normal project workflow. Let
   the existing CI/CD process deploy it to `sundai.club`. The image data tools
   stay manual; CI/CD runs only its normal Prisma schema migrations. There is
   no new image schema migration. Wait for the production deployment to finish.

   Between the database update and the new deployment, the old application can
   reject CloudFront image URLs. Old code also still writes new uploads to GCP.
   Keep these steps close together and check for writes during that interval.

7. Check existing project, chapter, event and avatar images on `sundai.club`.
   Upload and reload an image for each. In a Markdown description, test the file
   button, paste and drag/drop; save and reload. Check the returned CloudFront
   URL and the rendered image. Confirm no new 502 or S3 access errors. Private
   event material upload and download must still work. Keep the GCP source and
   database backup until these checks pass and the cutover is accepted. Remove
   the local production environment file when it is no longer needed.

There is no dual-write mode. A rollback must restore the database backup and its
matching deployment together. Images uploaded after the cutover need separate
handling before a restore. Neither migration tool deletes the GCP source.
