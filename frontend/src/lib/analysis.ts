import type { TechFile, Workspace } from '../types';

export function reportHeadingEntries(markdown: string): { title: string; line: number }[] {
  let fenced = false;
  return markdown.split('\n').flatMap((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    return heading ? [{ title: heading[1], line: index + 1 }] : [];
  });
}

export function reportHeadings(markdown: string): string[] {
  return reportHeadingEntries(markdown).map((entry) => entry.title);
}

export function splitSections(markdown: string) {
  const sections: { title: string; body: string }[] = [];
  let title = 'Overview';
  let lines: string[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (lines.join('\n').trim()) sections.push({ title, body: lines.join('\n').trim() });
      title = heading[1];
      lines = [];
    } else lines.push(line);
  }
  if (lines.join('\n').trim()) sections.push({ title, body: lines.join('\n').trim() });
  return sections;
}

export function getSection(markdown: string, pattern: RegExp) {
  return splitSections(markdown).filter((section) => pattern.test(section.title));
}

const labels: Record<string, string> = {
  '@google/genai': 'Google GenAI', express: 'Express', prisma: 'Prisma',
  '@prisma/client': 'Prisma', bullmq: 'BullMQ', ioredis: 'Redis', redis: 'Redis',
  '@aws-sdk/client-s3': 'AWS S3 SDK', zod: 'Zod', react: 'React', next: 'Next.js',
  typescript: 'TypeScript', '@clerk/express': 'Clerk', '@clerk/nextjs': 'Clerk',
  'groq-sdk': 'Groq SDK', '@openrouter/sdk': 'OpenRouter SDK', pg: 'PostgreSQL',
  '@neondatabase/serverless': 'Neon', fastapi: 'FastAPI', torch: 'PyTorch',
  transformers: 'Transformers', 'edge-tts': 'Edge TTS', langchain: 'LangChain',
  '@langchain/core': 'LangChain', '@langchain/textsplitters': 'LangChain',
  sqlalchemy: 'SQLAlchemy', asyncpg: 'PostgreSQL', pydantic: 'Pydantic',
};

export function technologies(files: TechFile[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    const name = file.file_name.toLowerCase();
    if (name === 'package.json') {
      try {
        const data = JSON.parse(file.file_content);
        for (const key of Object.keys({ ...data.dependencies, ...data.devDependencies })) {
          if (labels[key]) found.add(labels[key]);
        }
        if (typeof data.packageManager === 'string' && data.packageManager.startsWith('bun')) found.add('Bun');
      } catch { /* Incomplete manifests do not establish a dependency. */ }
    }
    if (name === 'pyproject.toml' || name === 'requirements.txt') {
      const lines = file.file_content.split('\n');
      for (const line of lines) {
        const match = /^\s*["']?([a-zA-Z0-9_.-]+)(?:\[[^\]]*\])?\s*(?:[<>=!~;"']|$)/.exec(line);
        if (match && labels[match[1].toLowerCase()]) found.add(labels[match[1].toLowerCase()]);
      }
    }
    if (name === 'dockerfile' || /^(docker-)?compose\.ya?ml$/.test(name)) found.add('Docker');
  }
  return [...found].sort();
}

export function normalizeUsername(input: string) {
  const invalid = () => new Error('Enter a valid GitHub username or profile URL.');
  let value = input.trim().replace(/^@/, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(www\.)?github\.com(?:\/|$)/i.test(value)) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); }
    catch { throw invalid(); }
    const segments = url.pathname.split('/').filter(Boolean);
    if (!['https:', 'http:'].includes(url.protocol)
      || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())
      || url.username || url.password || url.port || segments.length !== 1) throw invalid();
    value = segments[0];
  }
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value) || value.includes('--')) throw invalid();
  return value;
}

export function readSavedReports(storageKey = 'gitlens.reports'): Workspace[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Workspace => Boolean(item && !item.sample && typeof item.username === 'string'
      && typeof item.analysis === 'string' && typeof item.createdAt === 'string'
      && Array.isArray(item.repositories) && Array.isArray(item.tech)
      && item.context && Array.isArray(item.context.target_roles) && Array.isArray(item.warnings))).slice(0, 10);
  } catch { return []; }
}
