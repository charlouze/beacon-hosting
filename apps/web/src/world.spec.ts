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

  /** FIRST VIEWPORT fixes this scale, so it is a token and not a component value. */
  it('declares the display scale the contract names', () => {
    expect(styles).toContain('--display-countdown: 172px');
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
   * "What moves says something — the falling second, a length that passes
   * during a wait with no progress — and nothing moves to decorate." The
   * second is a signal being set, not a keyframe, so the one declared
   * animation of the whole surface is that length. A hover transition on a
   * control is not an animation.
   */
  it('animates one thing only: the length that passes on a step with no progress', () => {
    const animated = sources()
      .filter(([, source]) => {
        // Comments dropped first: a file is allowed to say why it does not
        // animate, and a prose sentence ending in "not an animation:" would
        // otherwise read as a declaration.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return code.includes('@keyframes') || /\banimation(-name)?\s*:/.test(code);
      })
      .map(([file]) => file.replaceAll('\\', '/'));

    expect(animated).toEqual(['apps/web/src/app/session/preparing.component.css']);
  });

  it('stops that length for whoever asked their system for less motion', () => {
    const sheet = readFileSync('apps/web/src/app/session/preparing.component.css', 'utf8');
    expect(sheet.match(/@keyframes/g)).toHaveLength(1);
    expect(sheet).toContain('@media (prefers-reduced-motion: reduce)');
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
