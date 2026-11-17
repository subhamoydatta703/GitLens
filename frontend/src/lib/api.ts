import type { AnalysisContext, Profile, Repository, TechFile, Workspace } from '../types';
import { normalizeUsername } from './analysis';

export function defaultApiBase() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';
}

export class EvidenceExpiredError extends Error {}

export type AnalysisProgress = 'submitting' | 'queued' | 'processing';

async function request<T>(base: string, path: string, signal: AbortSignal, body?: AnalysisContext, method: 'GET' | 'POST' = body ? 'POST' : 'GET'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      signal,
      method,
      cache: path.startsWith('/github/analysis/jobs/') ? 'no-store' : 'default',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('We couldn’t load this information right now. Please try again shortly.');
  }
  if (!response.ok) {
    if (path.startsWith('/github/analysis/jobs/')) {
      throw new Error(response.status === 404
        ? 'This analysis job is no longer available. Please generate a new report.'
        : 'We couldn’t check your analysis. Please try again shortly.');
    }
    if (response.status === 409) throw new EvidenceExpiredError('Your analysis evidence is no longer available. Reload your profile before generating insights.');
    if (response.status === 404) throw new Error('GitHub profile not found. Please check the username and try again.');
    if (response.status === 429) throw new Error('The request limit was reached. Wait a moment before trying again.');
    if (response.status === 422) throw new Error('Please review the information you entered and try again.');
    throw new Error(path.split('?')[0].endsWith('/analyze') ? 'Insights are temporarily unavailable. Please try again shortly.' : 'We couldn’t load your GitHub information. Please try again shortly.');
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
  try {
    const evidence = await request<{
      evidence_id: string; expires_at: number; repositories: Repository[]; tech: TechFile[];
    }>(base, `${path}/evidence`, signal, undefined, 'POST');
    if (typeof evidence?.evidence_id !== 'string' || !evidence.evidence_id
      || typeof evidence.expires_at !== 'number' || !Number.isFinite(evidence.expires_at)
      || evidence.expires_at * 1000 <= Date.now()
      || !Array.isArray(evidence.repositories)
      || !evidence.repositories.every((repo) => typeof repo?.repo === 'string' && typeof repo?.default_branch === 'string' && typeof repo?.fork === 'boolean')
      || !Array.isArray(evidence.tech)
      || !evidence.tech.every((file) => file && typeof file.repo === 'string' && typeof file.file_content === 'string' && typeof file.file_name === 'string' && typeof file.file_path === 'string')) {
      throw new Error('The portfolio evidence could not be read. Reload your profile to try again.');
    }
    workspace = {
      ...workspace, repositories: evidence.repositories, tech: evidence.tech,
      repositoriesLoaded: true, techLoaded: true,
      evidenceId: evidence.evidence_id, evidenceExpiresAt: evidence.expires_at * 1000,
    };
  } catch (error) {
    if (signal.aborted) throw error;
    workspace = { ...workspace, warnings: [...workspace.warnings,
      error instanceof Error ? error.message : 'Portfolio evidence could not be prepared. Reload your profile to try again.'] };
  }
  if (!signal.aborted) onUpdate(workspace);
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  return workspace;
}

export async function generateAnalysis(base: string, username: string, context: AnalysisContext, signal: AbortSignal, evidenceId?: string, onProgress?: (progress: AnalysisProgress) => void): Promise<string> {
  onProgress?.('submitting');
  const query = evidenceId ? `?evidence_id=${encodeURIComponent(evidenceId)}` : '';
  const job = await request<{ job_id: string }>(base, `/github/${encodeURIComponent(username)}/analyze${query}`, signal, context);
  if (typeof job?.job_id !== 'string' || !job.job_id.trim()) {
    throw new Error('Your analysis could not be started. Please try again.');
  }
  onProgress?.('queued');

  while (!signal.aborted) {
    const pollSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
    let result: { status: string; result?: { analysis?: string }; message?: string };
    try {
      result = await request<typeof result>(base, `/github/analysis/jobs/${encodeURIComponent(job.job_id)}`, pollSignal);
    } catch (error) {
      if (!signal.aborted && pollSignal.aborted) {
        throw new Error('We couldn’t confirm your analysis status. Your job may still be running. Please try again shortly.');
      }
      throw error;
    }

    if (result?.status === 'completed') {
      if (typeof result.result?.analysis !== 'string' || !result.result.analysis.trim()) {
        throw new Error('The AI returned an empty analysis. Please try again.');
      }
      return result.result.analysis;
    }
    if (result?.status === 'failed') {
      throw new Error('The analysis could not be completed. Please try again shortly.');
    }
    if (!['waiting', 'active', 'delayed', 'prioritized', 'waiting-children', 'paused'].includes(result?.status)) {
      throw new Error('We couldn’t read the analysis status. Please try again.');
    }
    onProgress?.(result.status === 'active' ? 'processing' : 'queued');
    await waitForNextPoll(signal);
  }
  throw new DOMException('Request cancelled', 'AbortError');
}

function waitForNextPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Request cancelled', 'AbortError')); return; }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Request cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, 2000);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
