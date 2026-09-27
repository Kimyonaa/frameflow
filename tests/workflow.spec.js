import { test, expect } from '@playwright/test';
const api = async (page, route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const me = await (await fetch('/api/auth/me')).json();
      const r = await fetch('/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    },
    { route, body },
  );
test('demo review, evidence task, approval and persisted reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good feedback/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/welcome.png', fullPage: true });
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(
    page.getByRole('heading', { name: 'Forma — brand & website', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/review.png', fullPage: true });
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('slider', { name: 'Comparison slider' }).fill('32');
  await expect(page.getByRole('slider')).toHaveValue('32');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: 'Add a comment', exact: true }).click();
  const art = page.locator('.artboard');
  const box = await art.boundingBox();
  await art.click({ position: { x: box.width * 0.6, y: box.height * 0.6 } });
  await page.getByLabel('What should change?').fill('Make the CTA label more specific.');
  await page.getByLabel('Connect to a requirement').selectOption('req-brand');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.comment').filter({ hasText: 'Make the CTA label' })).toBeVisible();
  const comment = page.locator('.comment').filter({ hasText: 'Make the CTA label' });
  await comment.getByRole('button', { name: 'Create linked task' }).click();
  await expect(comment.getByText('Linked to a task')).toBeVisible();
  await page.getByRole('button', { name: /^Tasks/ }).click();
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByLabel('Status for Make the CTA label more specific.').selectOption('done');
  await page.locator('.task-card').getByRole('button', { name: 'Evidence' }).click();
  await comment.getByRole('button', { name: 'Resolve', exact: true }).click();
  await page
    .locator('.comment')
    .filter({ hasText: 'Love the direction' })
    .getByRole('button', { name: 'Resolve', exact: true })
    .click();
  await page.getByRole('button', { name: 'Approve this version', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Approve this version', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Version approved', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Version approved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Find an answer', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toContainText('tasks completed');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  expect(errors).toEqual([]);
});
test('new project, upload, assistant review and version-scoped client link', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Project name', { exact: true }).fill('Northstar campaign');
  await modal.getByLabel('Client / team').fill('Northstar');
  await modal.getByLabel('One-line description').fill('A clearer launch story.');
  await modal
    .getByLabel('Client brief')
    .fill(
      'Create a clear pricing page for the launch. Make the primary call to action easy to find.',
    );
  await modal.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Northstar campaign', exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Plan with assistant' }).click();
  await page.getByRole('button', { name: 'Plan from brief' }).click();
  await page.getByRole('button', { name: 'Draft a proposal' }).click();
  await expect(page.locator('.proposal-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Apply reviewed proposal' }).click();
  await expect(page.getByRole('button', { name: 'Applied to project' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.requirements article')).toHaveCount(2);
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Upload your first version' }).click();
  await page.screenshot({ path: 'artifacts/upload-fixture.png' });
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles('artifacts/upload-fixture.png');
  await page.getByRole('button', { name: 'Upload version', exact: true }).click();
  await expect(page.locator('.artboard img')).toBeVisible();
  await page.getByRole('button', { name: 'Share for review', exact: true }).click();
  await page.getByRole('button', { name: 'Create review link', exact: true }).click();
  const link = await page.getByLabel('Review link', { exact: true }).inputValue();
  const context = await browser.newContext();
  const client = await context.newPage();
  await client.goto(link);
  await expect(
    client.getByRole('heading', { name: 'Northstar campaign', exact: true }),
  ).toBeVisible();
  await client.getByLabel('Reviewer name').fill('Client reviewer');
  await client.getByRole('button', { name: 'Add a comment', exact: true }).click();
  await client.locator('.artboard').click({ position: { x: 80, y: 80 } });
  await client.getByLabel('What should change?').fill('Please increase the contrast.');
  await client.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(client.locator('.comment')).toContainText('Please increase the contrast.');
  await context.close();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.comment')).toContainText('Please increase the contrast.');
});
test('mobile review is usable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.locator('.artboard')).toBeVisible();
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(fits).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
});
test('PDF versions render pages and retain page-specific pins', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  const document = await context.newPage();
  await document.setContent(
    '<html><body><h1>Review specimen</h1><p>Pricing should be clear.</p><div style="break-before:page"><h1>Second page</h1><p>Mobile navigation</p></div></body></html>',
  );
  const pdf = await document.pdf();
  await document.close();
  await page.getByRole('button', { name: 'Upload next version' }).click();
  await page.getByRole('dialog').getByLabel('Design name').fill('Two-page brief');
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('button', { name: 'Upload version', exact: true }).click();
  await expect(page.locator('.pdf-controls')).toContainText('Page 1 of 2');
  await page.getByRole('button', { name: 'Next PDF page' }).click();
  await expect(page.locator('.pdf-controls')).toContainText('Page 2 of 2');
  await page.getByRole('button', { name: 'Add a comment', exact: true }).click();
  await page.locator('.artboard').click({ position: { x: 80, y: 80 } });
  await page.getByLabel('What should change?').fill('Keep this on page two.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.comment')).toContainText('Keep this on page two.');
  await page.getByRole('button', { name: 'Previous PDF page' }).click();
  await expect(page.locator('.comment')).toHaveCount(0);
});
