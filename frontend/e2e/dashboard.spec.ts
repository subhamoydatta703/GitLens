import { expect, test, type Page } from '@playwright/test';

const profile = { login: 'octocat', name: 'Octocat', followers: 5, following: 2, bio: 'Building APIs and developer tools.' };
const report = '## Overview\nYour portfolio shows a focus on API development.\n## Role alignment\n### Backend Engineer\nYou report implemented rate limiting.\n## Recommendations\nDocument the existing middleware.';
async function mockApi(page: Page, onAnalysis: (body: unknown) => void = () => {}, failAnalysis = false) {
  await page.route('**/api/github/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/analyze')) {
      onAnalysis(route.request().postDataJSON());
      await route.fulfill({ status: failAnalysis ? 503 : 200, json: failAnalysis ? { detail: 'Model temporarily unavailable' } : { analysis: report } });
    } else if (pathname.endsWith('/repos')) {
      await route.fulfill({ json: [{ repo: 'actual-api', default_branch: 'main' }, { repo: 'docs-only', default_branch: 'docs' }] });
    } else if (pathname.endsWith('/tech-stack')) {
      await route.fulfill({ json: [
        { repo: 'actual-api', file_name: 'package.json', file_path: 'package.json', file_content: '{"dependencies":{"express":"*"}}' },
        { repo: 'evidence-only', file_name: 'package.json', file_path: 'package.json', file_content: '{}' },
      ] });
    } else await route.fulfill({ json: profile });
  });
}
async function loadProfile(page: Page) {
  await page.getByRole('textbox', { name: 'Start with your GitHub username' }).fill('https://github.com/octocat');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'Octocat', exact: true })).toBeVisible();
  await expect(page.getByText('GitHub profile and available evidence loaded.', { exact: true })).toBeVisible();
}
async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
}

test('username-first landing, actual repositories, explicit AI response, and saved report export', async ({ page }) => {
  const errors: string[] = [];
  const analyses: unknown[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await mockApi(page, (body) => analyses.push(body));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your GitHub tells a story/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/gitlens-landing.png', fullPage: true });
  await loadProfile(page);
  expect(analyses).toEqual([]);
  await expect(page.getByText('Jordan Ellis', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Growth plan', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/gitlens-live-overview.png', fullPage: true });
  await navigate(page, 'Repositories');
  await expect(page.getByRole('link', { name: 'actual-api', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'docs-only', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'evidence-only', exact: true })).toHaveCount(0);
  await navigate(page, 'AI insights');
  await expect(page.getByRole('heading', { name: 'No AI response yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Your context', exact: true }).click();
  await page.getByRole('button', { name: 'Backend Engineer', exact: true }).click();
  await page.getByLabel('Your goals').fill('Prepare my backend portfolio');
  await page.getByLabel('What should we know about your work?').fill('I already implemented rate limiting.');
  await page.getByRole('button', { name: 'Apply context' }).click();
  await page.getByRole('button', { name: 'Generate AI insights', exact: true }).click();
  await expect(page.getByText('Your portfolio shows a focus on API development.', { exact: true })).toBeVisible();
  expect(analyses).toEqual([{ target_roles: ['Backend Engineer'], goals: 'Prepare my backend portfolio', additional_information: 'I already implemented rate limiting.' }]);
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await navigate(page, 'Saved reports');
  await page.getByRole('button', { name: 'Open report for octocat' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  expect((await download).suggestedFilename()).toBe('gitlens-octocat.md');
  await navigate(page, 'Overview');
  await expect(page.getByRole('heading', { name: 'Octocat', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('fictional example is isolated and makes no API requests', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/github/')) calls.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'View example', exact: true }).click();
  await expect(page.getByText('DEMO DATA', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jordan Ellis' })).toBeVisible();
  await page.screenshot({ path: '/tmp/gitlens-sample-portfolio.png', fullPage: true });
  await page.getByText('Goals and experience included in this review', { exact: false }).click();
  await expect(page.getByText('Move toward backend-focused roles and explain the design decisions behind my projects more clearly.')).toBeVisible();
  await page.getByRole('tab', { name: 'Example repositories' }).click();
  await expect(page.getByText('knowledge-api', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /knowledge-api/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Example AI report' }).click();
  await expect(page.getByRole('heading', { name: 'Portfolio review for Jordan Ellis' })).toBeVisible();
  await page.screenshot({ path: '/tmp/gitlens-sample-report.png', fullPage: true });
  await expect(page.locator('body')).not.toContainText('subhamoy');
  await expect(page.locator('body')).not.toContainText('Resumark');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review your GitHub profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your GitHub tells a story/ })).toBeVisible();
  expect(calls).toEqual([]);
});

test('profile appears before technical files finish, and AI failure preserves actual data', async ({ page }) => {
  let releaseFiles: () => void = () => {};
  const filesReady = new Promise<void>((resolve) => { releaseFiles = resolve; });
  await mockApi(page, () => {}, true);
  await page.route('**/api/github/octocat/tech-stack', async (route) => { await filesReady; await route.fulfill({ json: [] }); });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Start with your GitHub username' }).fill('octocat');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'Octocat', exact: true })).toBeVisible();
  await expect(page.getByText('Profile loaded. Fetching repositories and technical evidence…')).toBeVisible();
  releaseFiles();
  await navigate(page, 'AI insights');
  await page.getByRole('button', { name: 'Generate AI insights', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Insights are temporarily unavailable');
  await expect(page.getByRole('heading', { name: 'No AI response yet.' })).toBeVisible();
  await navigate(page, 'Repositories');
  await expect(page.getByRole('link', { name: 'actual-api', exact: true })).toBeVisible();
  await navigate(page, 'Example');
  await page.getByRole('tab', { name: 'Example overview' }).click();
  await page.getByRole('button', { name: 'Back to your portfolio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Octocat', exact: true })).toBeVisible();
});

test('mobile landing and live pages fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await page.screenshot({ path: '/tmp/gitlens-landing-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await loadProfile(page);
  await page.screenshot({ path: '/tmp/gitlens-live-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigate(page, 'AI insights');
  await page.getByRole('button', { name: 'Your context', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Generate AI insights', exact: true }).click();
  await expect(page.getByText('Your portfolio shows a focus on API development.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invalid or missing profiles never show demo data as actual data', async ({ page }) => {
  await page.route('**/api/github/**', (route) => route.fulfill({ status: 404, json: { detail: 'not found' } }));
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Start with your GitHub username' });
  await input.fill('bad/name');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('valid GitHub username');
  await input.fill('missing-account');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('not found');
  await expect(page.getByRole('heading', { name: /Your GitHub tells a story/ })).toBeVisible();
  await expect(page.getByText('Jordan Ellis', { exact: true })).toHaveCount(0);
});

test('changing the loaded user resets repositories, AI output and user-specific context', async ({ page }) => {
  const submitted: unknown[] = [];
  await mockApi(page, (body) => submitted.push(body));
  await page.goto('/');
  await loadProfile(page);
  await navigate(page, 'AI insights');
  await page.getByRole('button', { name: 'Your context', exact: true }).click();
  await page.getByLabel('What should we know about your work?').fill('First user specific context');
  await page.getByRole('button', { name: 'Apply context' }).click();
  await page.getByRole('button', { name: 'Generate AI insights', exact: true }).click();
  await expect(page.getByText('Your portfolio shows a focus on API development.', { exact: true })).toBeVisible();
  await page.route(/\/api\/github\/second-user(?:\/.*)?$/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/repos') ? [{ repo: 'second-user-project', default_branch: 'main' }]
      : path.endsWith('/tech-stack') ? []
      : path.endsWith('/analyze') ? { analysis: '## Overview\nSecond user response.' }
      : { ...profile, login: 'second-user', name: 'Second user' };
    if (path.endsWith('/analyze')) submitted.push(route.request().postDataJSON());
    await route.fulfill({ json });
  });
  await page.getByRole('button', { name: 'Change profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Start with your GitHub username' }).fill('second-user');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'Second user', exact: true })).toBeVisible();
  await navigate(page, 'Repositories');
  await expect(page.getByRole('link', { name: 'second-user-project', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'actual-api', exact: true })).toHaveCount(0);
  await navigate(page, 'AI insights');
  await expect(page.getByRole('heading', { name: 'No AI response yet.' })).toBeVisible();
  await expect(page.getByText('Your portfolio shows a focus on API development.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate AI insights', exact: true }).click();
  await expect(page.getByText('Second user response.', { exact: true })).toBeVisible();
  expect(submitted[1]).toEqual({ target_roles: [], goals: null, additional_information: null });
});

test('visitors see product language instead of service configuration controls', async ({ page }) => {
  const setupCopy = /backend connection|check connection|configure backend|backend URL|analysis endpoint|your backend/i;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Turn your projects into a clear next step.' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(setupCopy);
  await mockApi(page);
  await loadProfile(page);
  await page.getByRole('button', { name: 'How it works', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText(setupCopy);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Change profile', exact: true }).click();
  await page.route('**/api/github/**', (route) => route.abort('failed'));
  await page.getByRole('textbox', { name: 'Start with your GitHub username' }).fill('octocat');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again shortly');
  await expect(page.locator('body')).not.toContainText(setupCopy);
});


test('main workspace remains locked until the requested GitHub profile is verified', async ({ page }) => {
  await page.goto('/?username=octocat&view=overview#overview');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  const input = page.getByRole('textbox', { name: 'Start with your GitHub username' });
  await input.fill('https://github.com/octocat/repository');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('valid GitHub username');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.route('**/api/github/**', async (route) => {
    await route.fulfill({ json: { login: 'different-user', name: 'Wrong profile', bio: null, followers: 0, following: 0 } });
  });
  await input.fill('octocat');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('GitHub profile');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View example', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to your portfolio', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review your GitHub profile', exact: true })).toBeVisible();
});

test('sample tabs, report sections and additional technologies work from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'View example', exact: true }).click();
  const overview = page.getByRole('tab', { name: 'Example overview', exact: true });
  await overview.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Example AI report', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Example AI report', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByText('Jump to a section', { exact: true }).click();
  await page.getByRole('link', { name: 'Recommended improvements and reasons', exact: true }).click();
  await expect(page.locator('#report-heading-4')).toHaveText('Recommended improvements and reasons');
  await expect(page.locator('#report-heading-4')).toBeInViewport();
  await page.getByRole('tab', { name: 'Example repositories', exact: true }).click();
  const extra = page.locator('details').filter({ has: page.locator('summary[aria-label="Additional technologies for projectflow"]') });
  await extra.locator('summary').click();
  await expect(extra.getByText('Zod', { exact: true })).toBeVisible();
  expect(await page.locator('.table-scroll').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test('mobile navigation traps focus and the context action stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await loadProfile(page);
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await navigate(page, 'AI insights');
  const context = page.getByRole('button', { name: 'Your context', exact: true });
  await context.click();
  const apply = page.getByRole('button', { name: 'Apply context', exact: true });
  await expect(apply).toBeInViewport();
  await page.getByLabel('What should we know about your work?').fill('Existing API middleware and tests.');
  await expect(apply).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(context).toBeFocused();
});
