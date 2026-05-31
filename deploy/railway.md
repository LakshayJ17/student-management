Railway deployment guide

This repo is a monorepo with two services:
- `apps/api` (Express + TypeScript + Prisma)
- `apps/web` (Next.js frontend)

Recommended Railway setup (single Railway project with two services):

1. Create a new Railway project.
2. Create two services in the project:
   - Service `api` — choose Docker deployment and point to `apps/api/Dockerfile`.
   - Service `web` — choose Docker deployment and point to `apps/web/Dockerfile`.
3. For the `api` service, add environment variables (Railway -> Variables):
   - `DATABASE_URL` (set to the connection string of your Postgres database managed by Railway or external like Neon). Example:
     ```text
     postgresql://username:password@host:5432/dbname?schema=public
     ```
   - `JWT_SECRET` (a long random string)
   - `CORS_ORIGIN` (e.g. `https://your-frontend-url` or `http://localhost:3000` for local testing)
   - `PORT=4000`
   - `TEACHER_EMAIL` and `TEACHER_PASSWORD` (seed credentials)
4. For the `web` service set:
   - `NEXT_PUBLIC_API_URL` pointing to the `api` service hostname or the Railway provided domain (e.g. `https://api-xxxx.up.railway.app`).

Notes & tips
- Railway provides Postgres as a plugin; if you use it, paste the connection string into `DATABASE_URL` for the `api` service.
- The `api` Dockerfile builds the TypeScript app and runs `node dist/server.js`.
- The `web` Dockerfile builds Next.js and runs `npm start` (Next.js production server).
- For lower cold-starts and connection pooling with Prisma + Postgres on serverless, use a connection pooler (Railway Postgres is persistent so the Docker approach is fine).

Deploy flow
- Push your branch to GitHub and connect the repo to Railway.
- Create two services, configure build paths to the Dockerfiles above, set env variables, and deploy.

Local testing with Docker
- Build and run API
  ```bash
  docker build -t student-api -f apps/api/Dockerfile apps/api
  docker run -p 4000:4000 --env-file apps/api/.env student-api
  ```
- Build and run Web
  ```bash
  docker build -t student-web -f apps/web/Dockerfile apps/web
  docker run -p 3000:3000 --env-file apps/web/.env.local student-web
  ```

If you want, I can also:
- Add a `railway.json` or `railway` configuration (Railway CLI) to automate creation, or
- Convert the `api` into serverless functions inside Next.js so you only need one Vercel/Railway service.
