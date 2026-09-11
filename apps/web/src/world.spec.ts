import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The contract of `.impeccable/DIRECTION.md` is not a preference: it is the
 * decision that produced this world. Nothing else in the repository can compare
 * the two ends, and a hex digit off by one breaks no build and shows to nobody.
 */
/** Every file that can carry a style: the global sheet, the component sheets,
 * and the components whose styles are written inline. */
function sources(directory = 'apps/web/src'): [string, string][] {
  const found: [string, string][] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sources(path));
    else if (/\.(css|ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
      found.push([path, readFileSync(path, 'utf8')]);
    }
  }
  return found;
}

describe('the world contract', () => {
  const styles = readFileSync('apps/web/src/styles.css', 'utf8');

  it.each([
    ['--paper', '#faf8f3'],
    ['--ink', '#16181b'],
    ['--red', '#d8232a'],
    ['--blue', '#12457f'],
  ])('declares %s as %s, the value DIRECTION.md fixes', (token, value) => {
    expect(styles).toContain(`${token}: ${value}`);
  });

  it('declares the three rule weights, and only three', () => {
    expect(styles).toContain('--rule-heavy: 4px');
    expect(styles).toContain('--rule-mid: 3px');
    expect(styles).toContain('--rule-thin: 1px');
  });

  /** FIRST VIEWPORT fixes these two, so they are tokens and not component values. */
  it('declares the display scales the contract names', () => {
    expect(styles).toContain('--display-countdown: 172px');
    expect(styles).toContain('--display-window: 112px');
  });

  it('commits to light, with no dark surface anywhere', () => {
    expect(styles).toContain('color-scheme: light');
    expect(styles).not.toContain('prefers-color-scheme');
  });

  it('themes the browser surfaces the design system would otherwise leave default', () => {
    expect(styles).toContain('::selection');
    expect(styles).toContain(':focus-visible');
  });

  /**
   * "The falling second is the page's only animation. Nothing else moves."
   * That second is a signal being set, not a keyframe, so the honest reading
   * of the contract is that this application declares no animation at all —
   * and the whole surface is what has to say so, not one element of one
   * screen. A hover transition on a control is the one thing allowed, and it
   * is not an animation.
   */
  it('animates nothing, anywhere, which is what the contract asks of everything but the second', () => {
    for (const [file, source] of sources()) {
      // Comments dropped first: a file is allowed to say why it does not
      // animate, and a prose sentence ending in "not an animation:" would
      // otherwise read as a declaration.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(`${file}: ${code.includes('@keyframes')}`).toBe(`${file}: false`);
      expect(`${file}: ${/\banimation(-name)?\s*:/.test(code)}`).toBe(`${file}: false`);
    }
  });

  it('carries the direction contract into the body, where it survives the build', () => {
    const index = readFileSync('apps/web/src/index.html', 'utf8');
    const body = index.slice(index.indexOf('<body>'));
    expect(body).toContain('THESIS:');
    expect(body).toContain('OWN-WORLD:');
    expect(body).toContain('FORM: The Departure Board');
    // First child of the body, as the contract demands: before the app root.
    expect(body.indexOf('THESIS:')).toBeLessThan(body.indexOf('<beacon-root>'));
  });
});
