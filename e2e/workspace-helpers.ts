import type { Page } from '@playwright/test';

/** Exercise page editing at its canonical Layout location, then return to the caller's tab. */
export async function runPageCommand(page: Page, name: string) {
  const active = await page.locator('.tabs button.active').innerText();
  if (active !== 'Layout') await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: name === 'Rotate page' ? 'Rotate right' : name, exact: true }).click();
  if (active !== 'Layout') await page.getByRole('button', { name: active, exact: true }).click();
}
