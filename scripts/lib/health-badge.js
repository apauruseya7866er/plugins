// The summary badge embedded in the plugins README.
//
// Kept in its own module so the colour logic can be unit tested. The rule it
// encodes matters: colour is proportional, not worst-case. Painting the badge
// red because one plugin in sixty fails turns routine scrape breakage into an
// alarm, and a red badge that cries wolf is a badge nobody reads.

const COLOR = {
  PASS: '#3fb950',
  PARTIAL: '#d29922',
  FAIL: '#f85149',
  NEUTRAL: '#8b949e',
};

/** Pick the label and colour for a set of counts. Exported for testing. */
export function badgeState({ total, fail, unknown }) {
  if (total === 0) return { label: 'no data', color: COLOR.NEUTRAL };
  if (fail === 0) {
    return unknown > 0
      ? { label: 'mostly passing', color: COLOR.PASS }
      : { label: 'all passing', color: COLOR.PASS };
  }
  if (fail / total > 1 / 3)
    return { label: 'mostly failing', color: COLOR.FAIL };
  return { label: 'some failing', color: COLOR.PARTIAL };
}

/**
 * Render the badge as a self-contained SVG.
 *
 * Self-contained matters: this is loaded through Camo as an <img>, so any
 * external reference would be a second request and could fail independently of
 * the badge itself.
 */
export function renderSummaryBadge(counts) {
  const { label, color } = badgeState(counts);
  const value = `${counts.pass}/${counts.total}`;
  const labelW = 12 + label.length * 7;
  const valueW = 20 + value.length * 8;
  const width = labelW + valueW;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14">${label}</text>
    <text x="${labelW + valueW / 2}" y="14">${value}</text>
  </g>
</svg>
`;
}
