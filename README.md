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
- **AWS Account** - S3 for file storage and CloudFront for public images

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


**AWS storage** (Optional for local development):
Use separate S3 buckets for public images and private event materials. Public
images are served through CloudFront. See the storage setup sections below.

#### Create `.env.local` file:

```bash
# Database (for local development)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sundai_db"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sundai_db"

# Clerk Authentication - GET THESE FROM YOUR CLERK DASHBOARD
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_actual_key_here"
CLERK_SECRET_KEY="sk_test_your_actual_secret_here"
WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# AWS public images (optional for local development)
S3_IMAGE_REGION="us-east-1"
S3_IMAGE_BUCKET="sundai-images-426771917681"
S3_IMAGE_PUBLIC_BASE_URL="https://d10whcg56p8om0.cloudfront.net"

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
    B --> F[Amazon S3 and CloudFront]
    A --> H[PostHog Analytics]
```

**Tech Stack:**
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL with Docker for local development
- **Authentication**: Clerk for user management
- **File Storage**: private S3 buckets; CloudFront for public images
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

Event material files use a dedicated private S3 bucket, separate from the image
bucket. The material bucket has no CloudFront origin or public read policy.
Browsers upload through a signed PUT URL. Downloads pass through the existing
authorization endpoint before receiving a signed GET URL.

Configure:

```bash
S3_MATERIALS_REGION=us-east-1
S3_MATERIALS_BUCKET=sundai-materials-426771917681
S3_MATERIALS_ROLE_ARN=arn:aws:iam::426771917681:role/sundai-images-production
```

Vercel uses the production OIDC role. Local development uses AWS CLI credentials.
The role needs PutObject, GetObject (including HEAD), and DeleteObject only for
`event-materials/*` in the private bucket. The setup script enables all public
access blocks, disables ACLs, enables encryption and versioning, and configures
CORS for signed PUT uploads from `https://sundai.club` and
`https://www.sundai.club`. Add a development origin to a separate development
bucket if you need local browser uploads; do not add wildcard production origins.
Upload URLs expire after 15 minutes; download URLs expire after 5 minutes. Do not
persist these URLs. Uploaded content type is part of the upload signature.

Material uploads are limited to 25 MiB and the passive-file allowlist displayed
in the organizer UI. The API checks the S3 object's size and MIME type before
creating a material record. Visibility, attendee and organizer access checks
remain unchanged.

Before deploying this change:

1. Have an AWS admin add the statements in
   `docs/s3-materials-operator-policy.json` to the operator's permissions.
   The current user was denied creation of `sundai-materials-426771917681`.
2. With Node 24 and the operator's AWS profile, run `npm run materials:setup`.
   This adds the separate runtime policy in
   `docs/s3-materials-production-policy.json` to the existing OIDC role. It does
   not replace the image policy or change the production trust policy.
3. Set the three `S3_MATERIALS_*` variables in Vercel Production.
4. Deploy through the existing main-branch CI/CD process. Keep the image data
   migration manual. There are no new Prisma schema migrations for storage.
5. Test a small private upload, finalization, authorized download, denied
   unauthorized download, and deletion on `sundai.club`.
6. After the production checks pass, remove the unused `GOOGLE_PRIVATE_KEY`,
   `GOOGLE_CLOUD_BUCKET`, `GOOGLE_CLOUD_MATERIALS_BUCKET` and `GEMINI_API_KEY`
   Vercel variables. They are not used by this cutover code. Old deployments
   still need their previous configuration until the cutover is complete.

The production database has zero EventMaterial records, and Production did not
configure a private GCP materials bucket at the audit. There is no material data
migration to apply for that state. Recheck before cutover; if files are added in
GCP, copy and verify them before changing their bucket references. The application
contains no GCP storage adapter or fallback.


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

### AWS Storage Setup:

Use the private-material setup procedure above. Configure public images with
the `S3_IMAGE_*` values in `.env.example`. The application no longer uses GCP
services.

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

## Remaining GCP resource audit

The code no longer uses GCP at runtime. One-time copy tools still read the GCP
source until the cutover is complete. The Sundai project audit found:

| Resource | State | Data to review before closing GCP |
| --- | --- | --- |
| `club-site-images` | Public image source | Images copied to S3; keep until cutover checks pass |
| `database_exports_sundai` | One object, about 1.9 MiB | Archive the existing database export if it must be retained |
| `runapps_default-vjzzzj` | Eight objects, about 89 KiB | Old app artifacts, last changed in October 2024; confirm their owner and archive needs |
| `tutu-files` | 77 objects, about 11 GiB | Not referenced by this website; confirm its owner and archive needs |
| Cloud SQL | Six stopped instances | `quizme-db`, `iap2025`, `prod-clone-for-v3`, `club-site-main`, `sundai-v3`, `sundai-dev`; check which data must be retained |
| Compute Engine | No instances found | No VM migration found in this check |

The current production website database is already in AWS RDS. Stopped Cloud SQL
instances are not empty databases. Preserve required data before any deletion.
No GCP bucket or instance was deleted. Cloud Run listing and the full Cloud Asset
inventory were denied; this is a partial service inventory. An admin must grant
read-only Cloud Run and Cloud Asset access, plus `serviceusage.services.use`, to
complete it. Enabled APIs alone do not prove that resources exist. Other GCP
projects visible to the account were outside this Sundai project audit.
