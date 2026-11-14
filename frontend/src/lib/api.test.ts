import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWorkspace, generateAnalysis } from './api';

afterEach(() => vi.unstubAllGlobals());
const context = { target_roles: ['Backend Engineer'], goals: null, additional_information: 'Rate limiting already exists.' };
const profile = { login: 'octocat', name: 'Octocat', followers: 5, following: 2, bio: null };

describe('GitHub data and AI are independent requests', () => {
  it('loads real profile and repository routes without invoking analysis', async () => {
    const mock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/repos') ? [{ repo: 'actual-repository', default_branch: 'main' }]
        : url.endsWith('/tech-stack') ? [] : profile,
    )));
    vi.stubGlobal('fetch', mock);
    const updates = vi.fn();
    const result = await fetchWorkspace('/api', 'octocat', new AbortController().signal, updates);
    expect(result.profile).toEqual(profile);
    expect(result.repositories.map((repo) => repo.repo)).toEqual(['actual-repository']);
    expect(result.analysis).toBe('');
    expect(result.sample).toBe(false);
    expect(mock.mock.calls.map(([url]) => url)).toEqual(['/api/github/octocat', '/api/github/octocat/repos', '/api/github/octocat/tech-stack']);
    expect(updates.mock.calls[0][0].profile).toEqual(profile);
    expect(updates.mock.calls[0][0].techLoaded).toBe(false);
    expect(result.repositoriesLoaded).toBe(true);
  });
  it('preserves the real profile if repositories or technical evidence fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/octocat')
      ? new Response(JSON.stringify(profile)) : new Response('{}', { status: 503 })));
    const result = await fetchWorkspace('/api', 'octocat', new AbortController().signal);
    expect(result.profile).toEqual(profile);
    expect(result.repositories).toEqual([]);
    expect(result.warnings).toHaveLength(2);
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
  it('sends context only to the explicit AI endpoint and returns its response unchanged', async () => {
    const response = '## Overview\nExact model response.\n\n## Advice\nDocument existing work.';
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/api/github/octocat/analyze');
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual(context);
      return new Response(JSON.stringify({ analysis: response }));
    });
    vi.stubGlobal('fetch', mock);
    expect(await generateAnalysis('/api', 'octocat', context, new AbortController().signal)).toBe(response);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('rejects empty model output instead of substituting example content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ analysis: null }))));
    await expect(generateAnalysis('/api', 'octocat', context, new AbortController().signal)).rejects.toThrow('empty analysis');
  });
});
