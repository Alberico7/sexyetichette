import { describe, expect, it } from 'vitest';
import { computeGeometry } from '@/model/geometry';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { toWireBitmap } from '@/printer/raster';
import { thumbnailDataUrl, thumbnailSize } from '@/render/thumbnail';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

describe('miniatura delle recenti', () => {
  it('lato più lungo ≤ 240 e proporzioni dell’area stampabile', () => {
    expect(thumbnailSize(1000, 500)).toEqual({ width: 240, height: 120 });
    expect(thumbnailSize(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it.each(['along', 'across'] as const)('PNG nel verso di lettura (%s)', async (direction) => {
    const g = computeGeometry(findMediaById('multi-purpose-small')!, direction, 50, LW550_HEAD);
    const { width, height } = g.printable;
    // Metà sinistra nera nel verso di lettura.
    const data = new Uint8Array(width * height * 4).fill(255);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width / 2; x++) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
    const wire = toWireBitmap({ width, height, data }, { rotate: g.wireRotation });

    const url = thumbnailDataUrl(wire, g);
    expect(url.startsWith('data:image/png')).toBe(true);
    expect(url.length).toBeLessThan(12_000);
    const img = await loadImage(url);
    const size = thumbnailSize(width, height);
    expect([img.width, img.height]).toEqual([size.width, size.height]);

    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[0]!;
    const midY = Math.floor(img.height / 2);
    expect(px(2, midY)).toBeLessThan(80);
    expect(px(img.width - 3, midY)).toBeGreaterThan(180);
  });
});
