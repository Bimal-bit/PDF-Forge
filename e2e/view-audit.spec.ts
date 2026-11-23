import { expect, test } from '@playwright/test';
import { openAdvanced } from './advanced-helpers';

test('scrolling follows the active display page without jumping back to its top', async ({ page }) => {
  await openAdvanced(page, 4);
  await page.locator('.canvas').evaluate((canvas) => {
    const target = canvas.querySelector<HTMLElement>('[data-page-number="3"]')!;
    canvas.scrollTop += target.getBoundingClientRect().top - canvas.getBoundingClientRect().top + 100;
  });
  await expect.poll(() => page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().selectedPage)).toBe(3);
  await expect.poll(() => page.getByRole('article', { name: 'Page 3', exact: true }).evaluate((sheet) => sheet.getBoundingClientRect().top - sheet.closest('.canvas')!.getBoundingClientRect().top)).toBeLessThan(0);
});

test('zooming keeps the left edge of large pages reachable', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  for (let index = 0; index < 10; index += 1) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.locator('.canvas').evaluate((canvas) => { canvas.scrollLeft = 0; });
  await expect.poll(() => page.getByRole('article', { name: 'Page 1', exact: true }).evaluate((sheet) => sheet.getBoundingClientRect().left - sheet.closest('.canvas')!.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0);
});

test('View adjustments preserve the next document Undo step', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text', { exact: true }).fill('Undo this edit');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Properties', exact: true }).click();
  await page.getByLabel('Undo', { exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((object) => object.type === 'text')?.text)).toBe('Text overlay');
});
