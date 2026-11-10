/** Il cerchietto di rotazione si aggancia anche ai multipli di 45°. */
import { connectSimulated, expect, test, writeText, type SimWindow } from './helpers';
import type { Page } from '@playwright/test';
import type { Stage } from 'konva/lib/Stage';

/** Centro del riquadro selezionato e posizione del cerchietto, in coordinate della pagina. */
async function handles(page: Page) {
  return page.evaluate(() => {
    const stage = (window as unknown as SimWindow).__sim.labelStage as Stage;
    const rect = stage.container().getBoundingClientRect();
    const tr = stage.findOne('Transformer')!;
    const rot = stage.findOne('.rotater')!.getAbsolutePosition();
    // Centro dell'elemento selezionato (il riquadro del Transformer comprende anche il cerchietto).
    const node = (
      tr as unknown as { nodes(): { getClientRect(): { x: number; y: number; width: number; height: number } }[] }
    ).nodes()[0]!;
    const box = node.getClientRect();
    return {
      rot: { x: rect.left + rot.x, y: rect.top + rot.y },
      center: { x: rect.left + box.x + box.width / 2, y: rect.top + box.y + box.height / 2 },
    };
  });
}

/** Trascina il cerchietto attorno al centro fino all'angolo indicato (0° = in alto, senso orario). */
async function dragTo(page: Page, deg: number): Promise<number> {
  // Lascia finire il ridisegno dopo «Fine» (carattere e adattamento): nel primo istante
  // il primo trascinamento segue il dito solo in parte (osservato nei test, 2026-11-06).
  await page.waitForTimeout(1500);
  const { rot, center } = await handles(page);
  const r = Math.hypot(rot.x - center.x, rot.y - center.y);
  const a = (deg * Math.PI) / 180;
  await page.mouse.move(rot.x, rot.y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    const t = (a * i) / 30;
    await page.mouse.move(center.x + r * Math.sin(t), center.y - r * Math.cos(t));
  }
  await page.mouse.up();
  return page.evaluate(() => {
    const stage = (window as unknown as SimWindow).__sim.labelStage as Stage;
    const tr = stage.findOne('Transformer') as unknown as { nodes(): { rotation(): number }[] };
    return Math.round(tr.nodes()[0]!.rotation());
  });
}

test('rotazione col cerchietto: si aggancia a 45° e a 90°', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Diagonale');
  expect(await dragTo(page, 42)).toBe(45);
  await writeText(page, 'Verticale');
  expect(await dragTo(page, 87)).toBe(90);
  await writeText(page, 'Libero');
  // Lontano dagli agganci l'angolo resta libero.
  expect(Math.abs((await dragTo(page, 25)) - 25)).toBeLessThanOrEqual(2);
});
