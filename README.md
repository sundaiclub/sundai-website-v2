# Sundai Website
r1

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### 1. Start the Database

First, start the PostgreSQL database using Docker:

```bash
# Start the database
docker-compose up -d

# To stop the database
docker-compose down

# To view database logs
docker-compose logs -f postgres
```

The database will be available at:

- Host: localhost
- Port: 5432
- User: postgres
- Password: postgres
- Database: sundai_db

### 2. Run the Development Server

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed the database (optional)
npx prisma db seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Database Connection

The application connects to a Google Cloud SQL PostgreSQL instance:

```bash
# Connection Details
Host: 34.148.221.200
Port: 5432
Database: sundai_db
Instance: sundai-club-434220:us-east1:club-site-main
Service Account: p199983032721-yeh8ti@gcp-sa-cloud-sql.iam.gserviceaccount.com
```

To connect locally, update your .env file with the correct DATABASE_URL.
