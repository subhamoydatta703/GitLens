import { describe, expect, it } from 'vitest';
import { normalizeUsername, splitSections, technologies, reportHeadings } from './analysis';
import type { TechFile } from '../types';

describe('GitHub profile input', () => {
  it('accepts usernames, handles, and profile URLs without treating a URL as a username', () => {
    expect(normalizeUsername(' @octocat ')).toBe('octocat');
    expect(normalizeUsername('https://github.com/octocat/')).toBe('octocat');
    expect(normalizeUsername('github.com/octocat')).toBe('octocat');
    expect(normalizeUsername('www.github.com/octocat')).toBe('octocat');
    expect(() => normalizeUsername('not/a/username')).toThrow();
    expect(() => normalizeUsername('bad--name')).toThrow();
    expect(() => normalizeUsername('https://github.com/octocat/repository')).toThrow();
    expect(() => normalizeUsername('https://github.com/')).toThrow();
    expect(() => normalizeUsername('https://github.com.example.org/octocat')).toThrow();
    expect(() => normalizeUsername('https://user:password@github.com/octocat')).toThrow();
  });
});

describe('analysis sections', () => {
  it('keeps role subsections and code-fenced headings inside their parent section', () => {
    const sections = splitSections('## Overview\nSummary\n## Role alignment\n### Backend Engineer\nEvidence\n```md\n## Not a real section\n```\n## Limitations\nPartial evidence');
    expect(sections.map((s) => s.title)).toEqual(['Overview', 'Role alignment', 'Limitations']);
    expect(sections[1].body).toContain('### Backend Engineer');
    expect(sections[1].body).toContain('## Not a real section');
    expect(reportHeadings('## Overview\n```md\n## Code example\n```\n## Recommendations')).toEqual(['Overview', 'Recommendations']);
  });
});

describe('declared technologies', () => {
  it('deduplicates related packages and does not treat arbitrary source mentions as declarations', () => {
    const files: TechFile[] = [
      { repo: 'api', file_name: 'package.json', file_path: 'package.json', file_content: JSON.stringify({ dependencies: { prisma: '*', '@prisma/client': '*', express: '*' }, description: 'We might use Redis later' }) },
      { repo: 'api', file_name: 'package.json', file_path: 'broken/package.json', file_content: 'not JSON with redis and zod mentioned' },
    ];
    expect(technologies(files)).toEqual(['Express', 'Prisma']);
  });
});
