import type { TechFile, Workspace } from '../types';

// Fictional portfolio fixtures. These are never used as live API results.
const manifest = (repo: string, dependencies: Record<string, string>, scripts: Record<string, string> = {}): TechFile => ({
  repo, file_name: 'package.json', file_path: 'package.json',
  file_content: JSON.stringify({ name: repo, private: true, scripts, dependencies }, null, 2),
});

export const exampleWorkspace: Workspace = {
  username: 'jordan-ellis',
  profile: {
    login: 'jordan-ellis', name: 'Jordan Ellis',
    bio: 'Full-stack developer building thoughtful web applications and practical AI tools. Exploring backend engineering and reliable search experiences.',
    followers: 68, following: 42,
  },
  repositories: [
    { repo: 'projectflow', default_branch: 'main' },
    { repo: 'knowledge-api', default_branch: 'main' },
    { repo: 'semantic-search', default_branch: 'develop' },
    { repo: 'release-notes-cli', default_branch: 'main' },
  ],
  tech: [
    manifest('projectflow', { react: '^19.0.0', typescript: '^5.9.0', zod: '^4.0.0', '@prisma/client': '^6.0.0' }, { dev: 'vite', build: 'tsc -b && vite build', test: 'vitest run' }),
    { repo: 'knowledge-api', file_name: 'pyproject.toml', file_path: 'pyproject.toml', file_content: '[project]\nname = "knowledge-api"\nrequires-python = ">=3.12"\ndependencies = [\n"fastapi>=0.115",\n"pydantic>=2.0",\n"sqlalchemy>=2.0",\n"asyncpg>=0.30"\n]\n[project.optional-dependencies]\ntest = ["pytest", "httpx"]' },
    { repo: 'knowledge-api', file_name: 'Dockerfile', file_path: 'Dockerfile', file_content: 'FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN pip install .\nRUN useradd --create-home appuser\nUSER appuser\nEXPOSE 8000\nCMD ["uvicorn", "knowledge_api.main:app", "--host", "0.0.0.0", "--port", "8000"]' },
    manifest('semantic-search', { '@google/genai': '^1.0.0', express: '^5.0.0', '@langchain/core': '^0.3.0', pg: '^8.0.0', zod: '^4.0.0' }, { dev: 'tsx src/server.ts', test: 'vitest run' }),
    manifest('release-notes-cli', { typescript: '^5.9.0', zod: '^4.0.0' }, { build: 'tsc', test: 'vitest run' }),
  ],
  sample: true, repositoriesLoaded: true, techLoaded: true,
  createdAt: '2026-11-01T10:00:00Z', warnings: [],
  context: {
    target_roles: ['Backend Engineer', 'AI Application Engineer'],
    goals: 'Move toward backend-focused roles and explain the design decisions behind my projects more clearly.',
    additional_information: 'I have two years of experience building web applications. In knowledge-api, I implemented Redis-backed rate limiting and integration tests for the main API endpoints. The middleware and test source files are outside this snapshot. In semantic-search, I built a small document search prototype and am working on evaluating its retrieval quality.',
  },
  analysis: `## Overview
Your portfolio brings together web interfaces, Python APIs, and an AI-assisted search prototype. **Backend engineering is the clearest stated direction**, with AI application development as a related area to explore.

ProjectFlow provides an application context, Knowledge API is a useful place to explain reliability decisions, and Semantic Search offers an opportunity to demonstrate how you assess AI behavior. Your additional context reports two years of web development experience, existing rate limiting, and API integration tests; those details inform this review but are not independently verified by the supplied files.

## Technical evidence
- **ProjectFlow:** \`projectflow/package.json\` declares React, TypeScript, Zod, and Prisma Client, with build and test commands. These declarations suggest a typed web application; they do not establish how validation or persistence is implemented.
- **Knowledge API:** \`knowledge-api/pyproject.toml\` declares FastAPI, Pydantic, SQLAlchemy, and asyncpg. Its Dockerfile defines a Python runtime and a non-root application user. This supports discussing API tooling and container packaging, without establishing production deployment or runtime security.
- **Semantic Search:** \`semantic-search/package.json\` declares Google GenAI, Express, LangChain, PostgreSQL tooling, and Zod. You describe a document search prototype, but retrieval quality cannot be assessed from these dependencies.
- **Release Notes CLI:** \`release-notes-cli/package.json\` declares TypeScript and Zod with build and test commands. The manifest suggests a smaller developer tool; command behavior and test coverage require source inspection.

## Strengths
### Projects with complementary purposes
The projects cover interfaces, APIs, search, and developer tooling. A focused explanation of how each solves a different problem would communicate more than a combined dependency list.

### Existing reliability work to build on
You report implemented rate limiting and integration tests in Knowledge API. Treat these as existing capabilities to document and demonstrate, rather than new features to add.

### A practical setting for AI evaluation
Your search prototype is a concrete place to explore relevance, grounding, and failure cases. It gives you a project-specific path for demonstrating AI application engineering beyond calling a model API.

## Role alignment
### Backend Engineer
**Supporting evidence:** The Knowledge API manifest declares an API framework, validation tooling, and database libraries. You also report rate limiting and endpoint integration tests.

**What to demonstrate:** Explain a representative request flow, the persistence boundary, and the behavior covered by existing tests. Show implementation links so a reader can distinguish your design decisions from tooling declarations.

**Limit:** This snapshot does not establish coverage, performance, deployment readiness, or a seniority level.

### AI Application Engineer
**Supporting evidence:** Semantic Search declares model and retrieval-related tooling, and you describe implementing a document search prototype.

**What to demonstrate:** Provide a repeatable example showing the input question, relevant source passages, generated answer, and evaluation outcome. Include a failure case and explain the tradeoff it exposes.

**Limit:** Hosted-model integration does not establish model-training experience, and dependencies alone do not verify a working retrieval pipeline.

## Recommended improvements and reasons
### 1. Document the reliability features you already built
**Role:** Backend Engineer. **Evidence or gap:** Rate limiting and integration tests are self-reported; their source is outside the snapshot. This is an evidence gap, not a missing-feature claim.

**Action:** In Knowledge API, link the existing middleware and representative integration tests from a short reliability section. Explain which operations are limited, how limits are stored, and what clients receive when a limit is exceeded. Describe the behavior the current tests actually cover.

**Why it matters:** Readers can assess a concrete engineering decision and its scope. **Done when:** The documentation points to the implementation and existing tests and explains a success case, a rejected request, and the relevant failure behavior.

### 2. Make search quality reproducible
**Role:** AI Application Engineer. **Evidence or gap:** You describe an evaluation effort, but the supplied material contains no evaluation cases or results.

**Action:** Surface any existing checks in Semantic Search. If a benchmark is not already in place, start with a small set of realistic questions and manually reviewed relevant passages. Record retrieval results, answer support, and examples where the system should acknowledge insufficient information.

**Why it matters:** A repeatable evaluation makes retrieval and generation failures easier to separate and discuss. **Done when:** Someone can run the documented evaluation, inspect the expected evidence, and review results and limitations.

### 3. Create one focused backend case study
**Role:** Backend Engineer. **Evidence or gap:** Manifests identify tools but do not explain your contribution or architectural tradeoffs.

**Action:** Use Knowledge API to describe the problem, request lifecycle, database boundaries, and one reliability tradeoff. Include a small architecture diagram and links to the files that support each claim. Reuse existing documentation where it already covers these points.

**Why it matters:** A reviewer can connect the tools to decisions you made and behavior you can demonstrate. **Done when:** The case study clearly distinguishes implemented features, your own contributions, and future plans.

## Suggested order of work
Start with the existing reliability implementation and tests: making that work visible requires no speculative feature development. Then organize the search evaluation evidence. Use those concrete artifacts to write the backend case study and update your portfolio summary.

## Limitations
This illustrative review uses a fictional profile, invented project files, and self-reported experience. It demonstrates the structure of a portfolio assessment; it is not an assessment of a real GitHub account. Application source code, executed tests, evaluation results, and deployment behavior are outside this example.`,
};
