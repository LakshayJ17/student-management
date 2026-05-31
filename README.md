# Student Performance Management System

Full-stack student performance platform with teacher workflows, student dashboards, analytics charts, and recommendation insights.

## Stack

- Frontend: Next.js (React + TypeScript)
- Backend: Express.js + TypeScript
- Database: PostgreSQL + Prisma ORM
- Charts: Recharts
- Security: Helmet, CORS, request rate limiting, Zod validation, XSS input sanitization, SQL injection-safe ORM usage, prompt injection guard rails

## Features

- Teacher login with email/password
- Continue as student without credentials
- Teacher-only actions:
  - Add student
  - Add test marks per student
  - Add notes per student
  - Assign homework per student
  - Record attendance per student
- Student dashboard:
  - Performance trend chart
  - Subject-wise chart
  - Homework status chart
  - Notes and homework feed
  - AI-style recommendation insights based on performance and homework behavior
- Class insights:
  - Class average
  - Top performer leaderboard

## Demo Credentials

- Email: teacher@school.com
- Password: Teacher@123

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

3. Configure Postgres and migrate

Make sure you have a running PostgreSQL server and a database created (example uses `studentdb`). Example using local Postgres:

```bash
# Create DB (postgres user must exist and you may need sudo or proper permissions)
createdb studentdb

# Then set your DATABASE_URL in `apps/api/.env` e.g.
# DATABASE_URL="postgresql://postgres:password@localhost:5432/studentdb?schema=public"

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate
npm run db:seed
```

4. Run both frontend and backend

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## Scripts

- `npm run dev` - Run API + web together
- `npm run dev:api` - Run backend only
- `npm run dev:web` - Run frontend only
- `npm run build` - Build both apps
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Create/apply schema migration
- `npm run db:seed` - Seed initial demo records

## API Summary

- `POST /api/auth/login` - Teacher login
- `GET /api/students` - Student list
- `GET /api/students/analytics/class` - Class analytics
- `GET /api/students/:id/profile` - Student dashboard data
- `POST /api/students/:id/insights` - Recommendation refresh (prompt-injection checked)
- Teacher protected endpoints require `Authorization: Bearer <token>`:
  - `POST /api/students`
  - `POST /api/students/:id/marks`
  - `POST /api/students/:id/notes`
  - `POST /api/students/:id/homeworks`
  - `POST /api/students/:id/attendance`
- Homework status update (open to student/teacher mode by design):
  - `PATCH /api/students/homeworks/:homeworkId`

## Security Notes

- CORS locked to configured frontend origin
- API rate limiting for general and auth routes
- Input schemas validated with Zod
- Request body string sanitization to limit XSS payloads
- Prompt-injection pattern guard for recommendation instruction input
- Prisma prevents raw string-concatenated SQL injection patterns by default model operations
