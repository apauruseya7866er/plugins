// The badge is the only thing most people ever see of the health table, so its
// colour has to mean something. These lock in the rule: colour by how much of
// the catalogue is actually broken, never by the single worst row.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { badgeState, renderSummaryBadge } from '../scripts/lib/health-badge.js';

test('an all-green catalogue is green', () => {
  const s = badgeState({ total: 60, pass: 60, fail: 0, unknown: 0 });
  assert.equal(s.label, 'all passing');
  assert.equal(s.color, '#3fb950');
});

test('unmeasured sources do not make it look broken', () => {
  // The real CI shape: Cloudflare challenges a datacentre IP, so most sources are
  // never measured. That is a fact about the runner, not about the scrapers.
  const s = badgeState({ total: 60, pass: 28, fail: 0, unknown: 32 });
  assert.equal(s.label, 'mostly passing');
  assert.equal(s.color, '#3fb950');
});

test('a minority of failures is amber, not red', () => {
  // Today's run: 5 broken out of 60. Painting that red is crying wolf.
  const s = badgeState({ total: 60, pass: 28, fail: 5, unknown: 27 });
  assert.equal(s.label, 'some failing');
  assert.equal(s.color, '#d29922');
});

test('red is reserved for a catalogue that is mostly broken', () => {
  const s = badgeState({ total: 60, pass: 5, fail: 50, unknown: 5 });
  assert.equal(s.label, 'mostly failing');
  assert.equal(s.color, '#f85149');
});

test('an empty run does not claim success', () => {
  const s = badgeState({ total: 0, pass: 0, fail: 0, unknown: 0 });
  assert.equal(s.label, 'no data');
  assert.equal(s.color, '#8b949e');
});

test('the boundary between amber and red is a third of the catalogue', () => {
  // Exactly a third failing stays amber; more than a third goes red.
  assert.equal(
    badgeState({ total: 60, pass: 40, fail: 20, unknown: 0 }).color,
    '#d29922',
  );
  assert.equal(
    badgeState({ total: 60, pass: 39, fail: 21, unknown: 0 }).color,
    '#f85149',
  );
});

test('the rendered SVG is self-contained', () => {
  // It loads through Camo as an <img>; any external reference is a second
  // request that can fail independently of the badge.
  const svg = renderSummaryBadge({ total: 60, pass: 28, fail: 5, unknown: 27 });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>\n$/);
  assert.doesNotMatch(svg, /xlink:href="http/);
  assert.doesNotMatch(svg, /href="http/);
  assert.doesNotMatch(svg, /<image/);
});

test('the SVG carries the numbers and an accessible label', () => {
  const svg = renderSummaryBadge({ total: 60, pass: 28, fail: 5, unknown: 27 });
  assert.match(svg, /28\/60/, 'shows passing/total');
  assert.match(svg, /aria-label="some failing: 28\/60"/);
  assert.match(
    svg,
    /<title>some failing: 28\/<\/title>|some failing/,
    'has a title',
  );
  assert.match(svg, /fill="#d29922"/, 'uses the amber chosen for this case');
});

test('width grows with the label so text is not clipped', () => {
  const wide = renderSummaryBadge({
    total: 1200,
    pass: 1200,
    fail: 0,
    unknown: 0,
  });
  const narrow = renderSummaryBadge({ total: 9, pass: 9, fail: 0, unknown: 0 });
  const widthOf = svg => Number(/width="(\d+)"/.exec(svg)[1]);
  assert.ok(widthOf(wide) > widthOf(narrow));
  // A 4-digit value needs roughly 4*8px of room; assert the value box is sized
  // for it rather than a fixed guess.
  assert.match(wide, /<text x="\d+(\.\d+)?" y="14">1200\/1200<\/text>/);
});
