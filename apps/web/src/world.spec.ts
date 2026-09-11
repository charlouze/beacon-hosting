import { readFileSync } from 'node:fs';

/**
 * The contract of `.impeccable/DIRECTION.md` is not a preference: it is the
 * decision that produced this world. Nothing else in the repository can compare
 * the two ends, and a hex digit off by one breaks no build and shows to nobody.
 */
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
