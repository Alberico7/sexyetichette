/**
 * Tema dell'interfaccia: automatico (segue il sistema), chiaro o scuro.
 * La scelta resta sul dispositivo. Il tema non influisce mai sull'immagine di stampa.
 */
import { computed, ref } from 'vue';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'etichettatrice.tema';
const ORDER: ThemePreference[] = ['auto', 'light', 'dark'];

export const THEME_LABELS: Record<ThemePreference, string> = {
  auto: 'automatico',
  light: 'chiaro',
  dark: 'scuro',
};

/**
 * Colore delle barre del browser e di Android per ciascun tema: quello dei pannelli
 * (`--surface` in base.css). Ripetuto in index.html; un test li confronta. Il manifest resta blu (docs/2026-11-10-pwa.md).
 */
export const META_COLORS: Record<EffectiveTheme, string> = { light: '#f8f6f1', dark: '#24272c' };

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'auto' || v === 'light' || v === 'dark';
}

export function nextPreference(p: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(p) + 1) % ORDER.length]!;
}

export function resolveTheme(p: ThemePreference, systemDark: boolean): EffectiveTheme {
  if (p === 'auto') return systemDark ? 'dark' : 'light';
  return p;
}

function loadPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function savePreference(p: ThemePreference): void {
  try {
    if (p === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, p);
  } catch {
    // archiviazione non disponibile: la scelta vale solo per questa sessione
  }
}

const media =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const themePreference = ref<ThemePreference>(typeof window === 'undefined' ? 'auto' : loadPreference());
const systemDark = ref(media?.matches ?? false);
media?.addEventListener('change', (e) => {
  systemDark.value = e.matches;
  applyTheme();
});

export const effectiveTheme = computed<EffectiveTheme>(() => resolveTheme(themePreference.value, systemDark.value));

export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (themePreference.value === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', themePreference.value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[effectiveTheme.value]);
}

export function setThemePreference(p: ThemePreference): void {
  themePreference.value = p;
  savePreference(p);
  applyTheme();
}

export function cycleTheme(): void {
  setThemePreference(nextPreference(themePreference.value));
}

/**
 * Risolve una variabile CSS in un colore utilizzabile sul canvas.
 * Le variabili usano light-dark(), che va risolta dal browser: la applico a un
 * elemento di prova e leggo il colore calcolato.
 */
export function cssColor(name: string, fallback: string): string {
  if (typeof document === 'undefined' || !document.body) return fallback;
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || fallback;
}
