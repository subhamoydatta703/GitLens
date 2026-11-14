import type { AnalysisContext, Profile, Repository, TechFile, Workspace } from '../types';
import { normalizeUsername } from './analysis';

export function defaultApiBase() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';
}

async function request<T>(base: string, path: string, signal: AbortSignal, body?: AnalysisContext): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      signal,
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('We couldn’t load this information right now. Please try again shortly.');
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error('GitHub profile not found. Please check the username and try again.');
    if (response.status === 429) throw new Error('The request limit was reached. Wait a moment before trying again.');
    if (response.status === 422) throw new Error('Please review the information you entered and try again.');
    throw new Error(path.endsWith('/analyze') ? 'Insights are temporarily unavailable. Please try again shortly.' : 'We couldn’t load your GitHub information. Please try again shortly.');
  }
  try { return await response.json(); }
  catch { throw new Error('We couldn’t read this information. Please try again shortly.'); }
}

export async function fetchWorkspace(
  base: string,
  username: string,
  signal: AbortSignal,
  onUpdate: (workspace: Workspace) => void = () => {},
): Promise<Workspace> {
  const requestedUsername = normalizeUsername(username);
  const path = `/github/${encodeURIComponent(requestedUsername)}`;
  const profile = await request<Profile>(base, path, signal);
  if (!profile || typeof profile.login !== 'string'
    || profile.login.toLowerCase() !== requestedUsername.toLowerCase()
    || !(profile.name === null || typeof profile.name === 'string')
    || !(profile.bio === null || typeof profile.bio === 'string')
    || !Number.isInteger(profile.followers) || profile.followers < 0
    || !Number.isInteger(profile.following) || profile.following < 0) {
    throw new Error('We couldn’t read this GitHub profile. Please try again.');
  }
  let workspace: Workspace = {
    username: profile.login, profile, repositories: [], tech: [], analysis: '',
    context: { target_roles: [], goals: null, additional_information: null },
    sample: false, createdAt: new Date().toISOString(), warnings: [],
    repositoriesLoaded: false, techLoaded: false,
  };
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  onUpdate(workspace);
  await Promise.all([
    (async () => {
      try {
        const repos = await request<Repository[]>(base, `${path}/repos`, signal);
        if (!Array.isArray(repos) || !repos.every((repo) => typeof repo?.repo === 'string' && typeof repo?.default_branch === 'string')) {
          throw new Error('The repository list could not be loaded.');
        }
        workspace = { ...workspace, repositories: repos, repositoriesLoaded: true };
      } catch (error) {
        if (signal.aborted) throw error;
        workspace = { ...workspace, warnings: [...workspace.warnings, 'Repository list could not be loaded.'] };
      }
      if (!signal.aborted) onUpdate(workspace);
    })(),
    (async () => {
      try {
        const files = await request<TechFile[]>(base, `${path}/tech-stack`, signal);
        if (!Array.isArray(files) || !files.every((file) => file && typeof file.repo === 'string' && typeof file.file_content === 'string' && typeof file.file_name === 'string' && typeof file.file_path === 'string')) {
          throw new Error('Project technology details could not be loaded.');
        }
        workspace = { ...workspace, tech: files, techLoaded: true };
      } catch (error) {
        if (signal.aborted) throw error;
        workspace = { ...workspace, warnings: [...workspace.warnings, 'Technology files could not be loaded.'] };
      }
      if (!signal.aborted) onUpdate(workspace);
    })(),
  ]);
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  return workspace;
}

export async function generateAnalysis(base: string, username: string, context: AnalysisContext, signal: AbortSignal): Promise<string> {
  const result = await request<{ analysis: string | null }>(base, `/github/${encodeURIComponent(username)}/analyze`, signal, context);
  if (typeof result?.analysis !== 'string' || !result.analysis.trim()) {
    throw new Error('The AI returned an empty analysis. Please try again.');
  }
  return result.analysis;
}
