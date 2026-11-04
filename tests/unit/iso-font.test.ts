import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import opentype from 'opentype.js';
import { createTextElement } from '@/model/document';
import { DEFAULT_FONT, FONT_OPTIONS, ISO_FONT } from '@/model/fonts';

const FILE = 'src/assets/fonts/osifont-lgpl3fe.woff';

describe('carattere «Tecnico ISO 3098» (osifont)', () => {
  const buf = readFileSync(FILE);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

  it('file presente e leggibile, con licenza LGPL 3 e font exception', () => {
    expect(font.names.windows?.fontFamily?.en ?? font.names.fontFamily?.en).toBe('osifont');
    const copyright = font.names.windows?.copyright?.en ?? '';
    expect(copyright).toContain('GNU LGPL version 3 with GPL font exception');
    for (const f of ['README.txt', 'lgpl-3.0.txt', 'gpl-3.0.txt']) expect(existsSync(`public/licenses/osifont/${f}`), f).toBe(true);
  });

  it('contiene lettere, cifre, accentate italiane e simboli usati sulle etichette', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789àèéìòùÀÈÉÌÒÙ.,;:!?()[]-+=/%°±×⌀Ø€&@#"\'';
    const missing = [...chars].filter((c) => font.charToGlyph(c).index === 0);
    expect(missing).toEqual([]);
  });

  it('è il carattere dei nuovi testi ed è il primo dell’elenco', () => {
    expect(DEFAULT_FONT).toBe(ISO_FONT);
    expect(createTextElement({ x: 0, y: 0, width: 50, height: 20 }).fontFamily).toBe(ISO_FONT);
    expect(FONT_OPTIONS[0]).toEqual({ value: ISO_FONT, label: 'Tecnico ISO 3098' });
  });
});
