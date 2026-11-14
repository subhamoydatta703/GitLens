import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const stage = process.env.UI_AUDIT_STAGE || 'after';
const directory = `/tmp/gitlens-ui-audit/${stage}`;

test('capture the UI review journey', async ({ page }) => {
  mkdirSync(directory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your GitHub tells a story/ })).toBeVisible();
  await page.screenshot({ path: `${directory}/01-landing-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/02-landing-mobile.png` });
  await page.getByRole('button', { name: 'View example', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jordan Ellis', exact: true })).toBeVisible();
  await page.screenshot({ path: `${directory}/03-overview-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${directory}/04-overview-desktop.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Example repositories' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.table-scroll tbody tr').first().evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${directory}/05-repositories-mobile.png` });
  await page.getByRole('tab', { name: 'Example AI report' }).click();
  await expect(page.getByRole('heading', { name: 'Portfolio review for Jordan Ellis' })).toBeVisible();
  await page.locator('.full-report .report-cover').evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${directory}/06-report-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${directory}/07-report-desktop.png` });
  await page.getByRole('button', { name: 'Review your GitHub profile', exact: true }).click();
  await page.route('**/api/github/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/repos') || path.endsWith('/tech-stack') ? [] : { login: 'octocat', name: 'Octocat', bio: null, followers: 5, following: 2 } });
  });
  await page.getByRole('textbox', { name: 'Start with your GitHub username' }).fill('octocat');
  await page.getByRole('button', { name: 'Explore my GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'Octocat', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.screenshot({ path: `${directory}/08-navigation-mobile.png` });
  await page.getByRole('button', { name: 'Add your context', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: `${directory}/09-context-mobile.png` });
});
