# 🚀 Sundai Club

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
- [🔑 Required External Services Setup](#-required-external-services-setup)
- [🚀 Learn More](#-learn-more)

## 🚀 Quick Start Guide for First-Time Setup

### Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and npm installed
- **Docker Desktop** installed AND running (not just installed!)
- **Git** for version control
- **Clerk Account** - Sign up at [clerk.com](https://clerk.com) for authentication
- **Google Cloud Project** - For file storage (optional for local development)

### 1. Clone & Install Dependencies

```bash
git clone [your-repo-url]
cd sundai-website-v2
npm install
```

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

if you already ran prisma beforehand plaese do the following, otherwise skip this step

```bash
# Reset and reseed the database with your profile included
npx prisma migrate reset --force
npx prisma db seed
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

# Clerk Authentication - GET THESE FROM YOUR CLERK DASHBOARD
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_actual_key_here"
CLERK_SECRET_KEY="sk_test_your_actual_secret_here"
CLERK_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Google Cloud Storage (optional for local development)
GOOGLE_CLOUD_BUCKET="your-bucket-name"

# PostHog Analytics (optional for local development)
NEXT_PUBLIC_POSTHOG_KEY="your_posthog_key"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

### 4. Database Setup

```bash
# Start PostgreSQL database container
docker-compose up -d

# Verify database is running
docker-compose ps

# Apply all database migrations
npx prisma migrate deploy

# Seed database with sample data
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run dev
```

🎉 **Success!** Visit [http://localhost:3000](http://localhost:3000) to see the application!

## 🧪 Testing

This project includes comprehensive testing with Jest, React Testing Library, and automated pre-commit hooks.

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
    B --> G[Push Notifications]
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
docker-compose ps
# If not running:
docker-compose up -d
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
docker-compose logs -f postgres    # View database logs
docker-compose down               # Stop database
docker-compose down -v            # Stop and remove database data

# Database reset (careful!)
docker-compose down -v
docker-compose up -d
npx prisma migrate deploy
npx prisma db seed

# Database backup/restore
npm run db:backup
npm run db:restore

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

## 🔑 Required External Services Setup

### Clerk Authentication Setup:
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your publishable key and secret key to `.env.local`
4. Add webhook endpoint for user sync: `[your-domain]/api/webhooks/clerk`
5. Configure sign-in/sign-up flows in Clerk dashboard

### Google Cloud Storage Setup (Optional):
1. Create Google Cloud Project
2. Enable Cloud Storage API
3. Create a storage bucket
4. Set up service account with storage permissions
5. Download service account key JSON file and add to project

## 🚀 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Prisma Documentation](https://www.prisma.io/docs) - Database ORM and migrations
- [Clerk Documentation](https://clerk.com/docs) - Authentication and user management
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS framework

---

Built with ❤️ by the Sundai Club team
