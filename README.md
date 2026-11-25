# GitLens

GitLens reviews your GitHub portfolio and suggests improvements for the roles
you’re targeting. It uses READMEs and technical files from up to 50 of your most
recently updated public repositories, including forks, along with any context
you choose to share.

## Requirements

- Python 3.14
- [uv](https://docs.astral.sh/uv/)
- Node.js 22.12+ (or a supported newer LTS) and npm for the frontend
- A Clerk application with GitHub sign-in enabled
- Redis for the BullMQ queue and PostgreSQL for the assessment schema
- A GitHub token and an OpenRouter API key

## Backend setup

Put the following settings in `backend/.env`.

| Variable | Value |
| --- | --- |
| `GITHUB_TOKEN` | Token used to fetch public GitHub data |
| `CLERK_SECRET_KEY` | Secret key from your Clerk application |
| `CLERK_AUTHORIZED_PARTIES` | Allowed Clerk session origins. Use `http://localhost:5173` locally. |
| `REDIS_URL` | Redis connection URL. Use the TCP URL for hosted Redis. |
| `OPENROUTER_API_KEY` | Key used for batch analysis and the final assessment |
| `DATABASE_URL` | PostgreSQL connection URL starting with `postgresql+psycopg://` |

Keep any connection options your PostgreSQL provider requires, such as
`sslmode=require&channel_binding=require`. Alembic reads the URL from the
backend environment.

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

The initial migration creates `github_users` and `github_assessment`, with up
to one assessment per user. The analysis worker currently returns completed
reports through BullMQ. Writing those reports to PostgreSQL is still pending.

FastAPI starts a BullMQ worker automatically. The worker runs the analysis
batches, then uses OpenRouter to produce a single Markdown assessment.

## Frontend setup

In the Clerk Dashboard, enable GitHub for sign-up and sign-in and disable
other sign-in methods. Add this claim under **Sessions → Customize session token**.

```json
{
  "github_username": "{{user.public_metadata.github_username}}"
}
```

On first use, FastAPI obtains the username from the connected GitHub account
and populates the metadata if the claim is missing.

Create `frontend/.env.local` with the publishable key from the same Clerk
application. Leave `VITE_API_BASE_URL` empty for local development.

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_BASE_URL=
```

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to FastAPI on port
8000. After signing in, choose **Explore my GitHub** to load your connected
profile and prepare repository evidence. Open **AI insights** to add optional
context and generate a report. **View example** opens a fictional review.

For a deployed frontend, set `VITE_API_BASE_URL` before building and set
`FRONTEND_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` on the backend to include the
deployed frontend origin.
