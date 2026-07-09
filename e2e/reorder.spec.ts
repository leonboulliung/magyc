import { test, expect, type Page } from "@playwright/test";
import { createSeededDraft, checkInvariants, type Draft } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "https://www.magyc.site";

async function openAsOwner(page: Page, d: Draft) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /#418|hydrat/i.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k as string, v as string),
    [d.ownerKey, d.ownerToken],
  );
  await page.goto(`/s/${d.id}`);
  await expect(page.locator('button[title="drag to reorder"]').first()).toBeVisible();
  return errors;
}

/** Centre coordinates of the grip handles for the moodboard cell (identified by
 *  its seeded image) and the parts_list cell (by its seeded text). Each grip
 *  lives inside a SortableCell whose inline style carries `grid-row`. */
async function gripCenters(page: Page) {
  return page.evaluate(() => {
    const grips = [...document.querySelectorAll('button[title="drag to reorder"]')] as HTMLElement[];
    const cellOf = (g: HTMLElement) => g.closest('[style*="grid-row"]') as HTMLElement | null;
    const find = (pred: (c: HTMLElement) => boolean) => {
      for (const g of grips) {
        const c = cellOf(g);
        if (c && pred(c)) { const r = g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
      }
      return null;
    };
    return {
      moodboard: find((c) => !!c.querySelector('img[src*="picsum"]')),
      parts: find((c) => (c.innerText || "").includes("SONY A7 (E2E)")),
    };
  });
}

async function dndDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 4 }); // pass dnd-kit's 4px activation
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.move(to.x, to.y + 4, { steps: 3 });
  await page.mouse.up();
}

test("swapping two widgets keeps their content — no vanish, no #418", async ({ page }) => {
  const d = await createSeededDraft(BASE);
  const errors = await openAsOwner(page, d);

  // Content present before the swap.
  await expect(page.getByText("SONY A7 (E2E)")).toBeVisible();
  await expect(page.locator('img[src*="picsum"]')).toHaveCount(1);

  const before = await gripCenters(page);
  expect(before.moodboard && before.parts, "seeded moodboard + parts grips found").toBeTruthy();
  await dndDrag(page, before.moodboard!, before.parts!);

  // Let the optimistic order + server refetch settle, then assert the content
  // is STILL there. The bug blanked both swapped elements until a reload.
  await page.waitForTimeout(2500);
  await expect(page.getByText("SONY A7 (E2E)")).toBeVisible();
  await expect(page.locator('img[src*="picsum"]')).toHaveCount(1);

  expect(errors, `hydration/#418 errors: ${errors.join(" | ")}`).toEqual([]);
  expect(await checkInvariants(BASE, d.id), "server invariants after reorder").toEqual([]);
});

test("two tabs swap the same elements at once — both stay consistent", async ({ browser }) => {
  const d = await createSeededDraft(BASE);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await openAsOwner(a, d);
  await openAsOwner(b, d);

  const [ca, cb] = await Promise.all([gripCenters(a), gripCenters(b)]);
  // Fire both swaps concurrently.
  await Promise.all([
    dndDrag(a, ca.moodboard!, ca.parts!),
    dndDrag(b, cb.moodboard!, cb.parts!),
  ]);
  await Promise.all([a.waitForTimeout(3000), b.waitForTimeout(3000)]);

  // Both tabs must still show the content (one tab's reorder 409s and refetches
  // to the winner's order — content must survive in both, no orphans server-side).
  for (const p of [a, b]) {
    await expect(p.getByText("SONY A7 (E2E)")).toBeVisible();
    await expect(p.locator('img[src*="picsum"]')).toHaveCount(1);
  }
  expect(await checkInvariants(BASE, d.id), "server invariants after concurrent reorder").toEqual([]);

  await ctxA.close();
  await ctxB.close();
});
