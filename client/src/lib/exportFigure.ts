import { toPng } from 'html-to-image';

// Resolve the page background color so exported PNGs are not transparent.
// Falls back to white if the CSS variable cannot be read.
function resolveBackgroundColor(node: HTMLElement): string {
  const styles = getComputedStyle(node);
  const bg = styles.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
  const rootBg = getComputedStyle(document.body).backgroundColor;
  if (rootBg && rootBg !== 'rgba(0, 0, 0, 0)' && rootBg !== 'transparent') {
    return rootBg;
  }
  return '#ffffff';
}

export type ExportResult = { ok: true } | { ok: false; error: string };

// Capture a DOM node (SVG + canvas + text) to a PNG and trigger a download.
// Uses html-to-image, which inlines computed styles and embeds canvas pixels,
// so it works for the mixed SVG/canvas figures and runs fully client-side
// (safe for static GitHub Pages hosting — no backend, no storage).
export async function exportNodeToPng(
  node: HTMLElement | null,
  filename: string,
): Promise<ExportResult> {
  if (!node) return { ok: false, error: 'Nothing to export yet.' };
  try {
    const dataUrl = await toPng(node, {
      backgroundColor: resolveBackgroundColor(node),
      pixelRatio: 2,
      cacheBust: true,
      // The page links a large cross-origin Google Fonts stylesheet. Trying to
      // inline it triggers SecurityErrors (cssRules is blocked cross-origin) and
      // is slow, so skip remote font embedding — the capture uses the fonts the
      // browser already rendered, which is sufficient for a figure grab.
      skipFonts: true,
      fontEmbedCSS: '',
      // Skip elements explicitly marked as non-exportable (e.g. the button itself).
      filter: (el) => {
        if (!(el instanceof HTMLElement)) return true;
        return el.dataset.exportExclude !== 'true';
      },
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
