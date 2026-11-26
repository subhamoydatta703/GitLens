import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGitHubIdentity, fetchWorkspace, generateAnalysis } from './api';

afterEach(() => vi.unstubAllGlobals());
const context = { target_roles: ['Backend Engineer'], goals: null, additional_information: 'Rate limiting already exists.' };
const profile = { login: 'octocat', name: 'Octocat', followers: 5, following: 2, bio: null };
const getToken = async () => 'test-token';

describe('GitHub identity and cached assessment', () => {
  it('returns github_username and cached assessment from /me when present', async () => {
    const assessment = {
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'octocat',
      report: '## Overview\nCached report.',
      created_at: '2026-11-26T12:00:00Z',
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      user_id: 'user_123',
      session_id: 'sess_123',
      github_username: 'octocat',
      refresh_session: false,
      assessment,
    }))));

    const identity = await fetchGitHubIdentity('/api', new AbortController().signal, getToken);
    expect(identity).toEqual({
      github_username: 'octocat',
      refresh_session: false,
      assessment,
    });
  });

  it('returns assessment: null when no report exists in /me', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      github_username: 'octocat',
      refresh_session: false,
      assessment: null,
    }))));

    const identity = await fetchGitHubIdentity('/api', new AbortController().signal, getToken);
    expect(identity.assessment).toBeNull();
  });
});

describe('GitHub data and AI are independent requests', () => {
  it('loads real profile and evidence routes without invoking analysis', async () => {
    const mock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/evidence')
        ? {
            evidence_id: 'ev_123',
            expires_at: Math.floor(Date.now() / 1000) + 600,
            repositories: [{ repo: 'actual-repository', default_branch: 'main', fork: false }],
            tech: [],
          }
        : profile,
    )));
    vi.stubGlobal('fetch', mock);
    const updates = vi.fn();
    const result = await fetchWorkspace('/api', 'octocat', new AbortController().signal, updates, getToken);
    expect(result.profile).toEqual(profile);
    expect(result.repositories.map((repo) => repo.repo)).toEqual(['actual-repository']);
    expect(result.analysis).toBe('');
    expect(result.sample).toBe(false);
    expect(result.evidenceId).toBe('ev_123');
    expect(mock.mock.calls.map(([url]) => url)).toEqual(['/api/github/octocat', '/api/github/octocat/evidence']);
    expect(updates.mock.calls[0][0].profile).toEqual(profile);
    expect(updates.mock.calls[0][0].techLoaded).toBe(false);
    expect(result.repositoriesLoaded).toBe(true);
  });

  it('preserves the real profile if evidence preparation fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/octocat')
      ? new Response(JSON.stringify(profile)) : new Response('{}', { status: 503 })));
    const result = await fetchWorkspace('/api', 'octocat', new AbortController().signal, undefined, getToken);
    expect(result.profile).toEqual(profile);
    expect(result.repositories).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.repositoriesLoaded).toBe(false);
    expect(result.techLoaded).toBe(false);
  });

  it('does not treat a failed profile request as a user or sample workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    await expect(fetchWorkspace('/api', 'missing', new AbortController().signal)).rejects.toThrow('not found');
  });

  it('does not unlock a workspace from malformed or mismatched profile data', async () => {
    const updates = vi.fn();
    for (const response of [{ login: 'octocat' }, { ...profile, login: 'different-user' }, { ...profile, followers: -1 }]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(response))));
      await expect(fetchWorkspace('/api', 'octocat', new AbortController().signal, updates)).rejects.toThrow('GitHub profile');
    }
    expect(updates).not.toHaveBeenCalled();
  });

  it('submits context to /analyze and polls /analysis/jobs/{job_id} until completed', async () => {
    const response = '## Overview\nExact model response.\n\n## Advice\nDocument existing work.';
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/github/octocat/analyze?evidence_id=ev_123') {
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual(context);
        return new Response(JSON.stringify({ job_id: 'job_123' }));
      }
      if (url === '/api/github/analysis/jobs/job_123') {
        expect(init.method).toBe('GET');
        return new Response(JSON.stringify({ status: 'completed', result: { analysis: response } }));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', mock);
    expect(await generateAnalysis('/api', 'octocat', context, new AbortController().signal, 'ev_123', undefined, getToken)).toBe(response);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('rejects empty model output instead of substituting example content', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/analyze') ? { job_id: 'job_123' } : { status: 'completed', result: { analysis: null } },
    ))));
    await expect(generateAnalysis('/api', 'octocat', context, new AbortController().signal, undefined, undefined, getToken)).rejects.toThrow('empty analysis');
  });
});
