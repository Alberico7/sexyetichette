/**
 * Stato della stampante mostrato dal logo del pettirosso nella barra in alto.
 * Vedi docs/2026-11-08-logo-stato.md.
 */
export type StatusTone = 'off' | 'busy' | 'ok' | 'warn' | 'error';

/** Segno sul tondino in basso a destra: aiuta chi distingue male verde e rosso. */
export function statusMark(tone: StatusTone): string {
  switch (tone) {
    case 'ok':
      return '✓';
    case 'warn':
      return '!';
    case 'error':
      return '✕';
    default:
      return '';
  }
}
