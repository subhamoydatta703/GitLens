# GitLens frontend

React, TypeScript, and Vite frontend for the project's FastAPI GitHub analysis API.
The visual foundation is the [Analytics Dashboard community template](https://www.figma.com/design/zLTK54f6Jmt1uPKyahS0XK/Analytics-Dashboard--Community-?node-id=0-1).
Original sidebar SVGs are stored locally in `public/assets/figma`. No temporary Figma URLs are used at runtime.

## Run locally

Start the configured backend from `backend/`:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Then, from `frontend/`:

```bash
npm install
npm run dev
```

Vite forwards `/api/*` to `http://127.0.0.1:8000/*`, including POST context and long-running analysis requests. Set `BACKEND_URL` when starting Vite to change that proxy target. The backend's GitHub and Gemini credentials remain server-side.

The website opens on a username-first landing page. **Explore my GitHub** fetches the profile, then prepares the repository, README, and technical-file evidence. The backend stores the collected evidence temporarily; analysis is enabled only after preparation succeeds. Overview appears as soon as the profile is available, without generating AI content. In **AI insights**, optionally add context and explicitly generate the AI response. **Example** is an isolated offline section containing Jordan Ellis, a fictional developer, four realistic sample repositories, technical files, and a detailed illustrative report; it never queries GitHub or replaces real data.

## API integration

The frontend uses these endpoints:

- `GET /github/{username}`: profile details, shown immediately after validation.
- `POST /github/{username}/evidence`: prepares and temporarily stores `AIInput`; returns `evidence_id`, `expires_at` (Unix seconds), all repositories including forks, and technical files. It does not generate AI content.
- `POST /github/{username}/analyze?evidence_id=...`: reads prepared evidence and attaches `target_roles`, `goals`, and `additional_information` from the request body. Returns `{ "analysis": "Markdown..." }` without fetching GitHub again.

The evidence store holds up to 20 profiles for ten minutes in one backend process. Restarting the backend clears it; it is not shared across multiple workers. Expired, missing, or mismatched evidence produces HTTP 409 and requires reloading the profile. Concurrent preparation requests for one username share the same collection. User context is copied into each analysis request and is not stored with shared evidence.

Overview appears before preparation finishes. The Generate button remains disabled until evidence is ready, and disables again when it expires or the server reports it missing. Repositories and technical files come from the same prepared result, so the frontend does not separately refetch `/repos` and `/tech-stack`. Failed preparation keeps the profile visible; failed analysis preserves fetched data. Requests can be cancelled and the frontend stops waiting after four minutes. Cancelling a browser request does not guarantee cancellation of backend work shared by other callers.

For production, set the public `VITE_API_BASE_URL` before building. A static hosted frontend does not host the Python backend or provide Vite's development proxy. Deploy FastAPI separately with HTTPS and set `FRONTEND_ORIGINS` on the backend to the exact frontend origin (comma-separated for multiple origins). For the private Sites preview, include `https://gitlens-portfolio-insights.airycob8.chatgpt.site`. Do not put API keys in frontend environment variables.

## Features and data

- Username-first landing page, live profile overview, actual repository list, evidence-count chart, and full Markdown AI response. Growth Plan and the Resources Settings link have been removed.
- Optional context is included only when generating AI insights; profile loading never calls the analysis endpoint. Applying context edits does not regenerate a report automatically.
- Reports are persisted to localStorage only when **Save report** is clicked, including that report's original context. Up to ten reports can be stored, opened, or removed. They are browser-local, not account-synced.
- Service configuration is managed through `VITE_API_BASE_URL` at build time. Visitors see no configuration controls or setup instructions. No login or authentication is implied.
- Export downloads the actual AI response as Markdown. Demo reports cannot be saved into real reports. Legacy saved samples are excluded, and opening a saved response does not overwrite the live profile.
- `react-markdown` renders model output without enabling raw HTML. Source files are never executed.

## Checks and build

```bash
npm test
npm run build
npm run preview
```

The production static output is `dist/`. `.openai/hosting.json` retains the private Sites preview identity; it contains no credentials.

## UI review and profile gate

The main workspace is rendered only after a successful profile lookup returns a matching, valid GitHub profile. Username syntax, profile URL shape, response identity, and profile fields are validated; failed requests and saved browser reports do not unlock the workspace. The public sample is a separate page without main navigation.

The UI review added mobile repository cards, expandable technology lists, report section navigation, a pinned context-form action row, keyboard support for sample tabs, mobile navigation focus management, and explicit focus restoration. See `docs/UI-REVIEW.md` for review notes and verification limits. Screenshots are kept locally and excluded from version control.
