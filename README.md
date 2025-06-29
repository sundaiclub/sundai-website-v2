# 🚀 Sundai Club - Hackathon & Project Management Platform

A modern platform for managing hackathons, tracking attendance, showcasing projects, and connecting the hacker community. Built with Next.js, TypeScript, and PostgreSQL.

## ✨ Features Overview

- 👥 **Hacker Profiles** - Personal portfolios with GitHub, Discord, LinkedIn integration
- 🛠️ **Project Management** - Create, join, and showcase hackathon projects
- 📊 **Attendance Tracking** - QR code-based check-ins with admin verification
- 🏆 **Project Showcase** - Browse and discover community projects with likes/stars
- 🎯 **Tech & Domain Tags** - Categorize projects by technology and domain
- 🔔 **Push Notifications** - Stay updated on new projects and activity
- 👑 **Admin Portal** - Manage users, approve projects, and track engagement

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
```

## 📖 Feature Documentation

| Feature | Description | Key Pages |
|---------|-------------|-----------|
| [👥 User Onboarding](#user-onboarding) | Clerk authentication & profile setup | `/join`, `/me` |
| [🛠️ Project Management](#project-management) | Create, edit, join projects | `/projects`, `/projects/new` |
| [📊 Attendance System](#attendance-system) | QR code check-ins & tracking | `/attendance` |
| [🏆 Project Showcase](#project-showcase) | Browse & discover projects | `/projects`, `/` |
| [👑 Admin Portal](#admin-portal) | User & project management | `/admin` |
| [🔔 Notifications](#notifications) | Push notification system | Service Worker |
| [📱 PWA Features](#pwa-features) | Mobile-first responsive design | Manifest, SW |

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

## 📦 Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

**Important**: Make sure to add all environment variables to your Vercel project settings before deploying.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## 📝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

Built with ❤️ by the Sundai Club team
