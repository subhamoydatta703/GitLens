# Fast API Project

A FastAPI backend and React dashboard for GitHub portfolio analysis. GitLens
combines repository evidence with optional user context to generate role-focused
AI guidance.

## Requirements

- Python 3.14
- [uv](https://docs.astral.sh/uv/)
- Node.js 22.12+ (or a supported newer LTS) and npm for the frontend

## Backend setup

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Configure the backend's GitHub token and Gemini credentials before starting it.
The AI service uses Google's `google-genai` SDK, which must be installed in the
backend environment.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. Development requests to
`/api` are proxied to FastAPI on port 8000. The landing page asks for a GitHub username, then loads real profile and
repository data. AI generation is a separate action in AI Insights. Fictional
demo content is isolated in the Example section.

See [frontend/README.md](frontend/README.md) for backend connection settings,
deployment, optional context, report storage, and verification commands.
