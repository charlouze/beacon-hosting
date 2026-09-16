import { describe, expect, it } from 'vitest';
import { companionFiles, companionSources, fingerprintOf, sourcesOf } from './fingerprint.js';

describe('sourcesOf', () => {
  it('drops the third-party inputs the lockfile already pins', () => {
    const metafile = {
      inputs: {
        'deploy/companion/src/agent.ts': { bytes: 10 },
        'node_modules/tar/index.js': { bytes: 20 },
      },
    };

    expect(sourcesOf(metafile)).toEqual(['deploy/companion/src/agent.ts']);
  });

  it('orders them, so the order esbuild happened to emit cannot move the fingerprint', () => {
    const metafile = {
      inputs: {
        'libs/session/src/index.ts': { bytes: 10 },
        'deploy/companion/src/agent.ts': { bytes: 20 },
      },
    };

    expect(sourcesOf(metafile)).toEqual([
      'deploy/companion/src/agent.ts',
      'libs/session/src/index.ts',
    ]);
  });
});

describe('fingerprintOf', () => {
  it('changes when a source changes', () => {
    const before = fingerprintOf(new Map([['a.ts', 'one']]));
    const after = fingerprintOf(new Map([['a.ts', 'two']]));

    expect(after).not.toEqual(before);
  });
  it('does not depend on the order the files were collected in', () => {
    const one = fingerprintOf(
      new Map([
        ['a.ts', 'one'],
        ['b.ts', 'two'],
      ]),
    );
    const other = fingerprintOf(
      new Map([
        ['b.ts', 'two'],
        ['a.ts', 'one'],
      ]),
    );

    expect(other).toEqual(one);
  });
  it('changes when a source moves, though its bytes do not', () => {
    const before = fingerprintOf(new Map([['a.ts', 'one']]));
    const after = fingerprintOf(new Map([['b.ts', 'one']]));

    expect(after).not.toEqual(before);
  });
  // A path and the content beside it are two fields, not one run of bytes:
  // without a separator, `a` holding `b` and `ab` holding nothing hash the same.
  it('keeps two different sets apart when their bytes would run together', () => {
    const one = fingerprintOf(new Map([['a', 'b']]));
    const other = fingerprintOf(new Map([['ab', '']]));

    expect(other).not.toEqual(one);
  });

  // Otherwise the guard would rest on a git setting: `core.autocrlf` decides
  // how a checkout spells its newlines, and a contributor whose tree carries
  // CRLF would compute an image fingerprint no runner could ever agree with.
  it('does not move because a checkout spells its newlines differently', () => {
    const lf = fingerprintOf(new Map([['a.ts', 'one\ntwo\n']]));
    const crlf = fingerprintOf(new Map([['a.ts', 'one\r\ntwo\r\n']]));

    expect(crlf).toEqual(lf);
  });
});

describe('the sources of the image the catalogue pins', () => {
  // The invariant the whole scheme rests on. `companion-image.ts` lives in
  // cloud-init and carries the pin; were cloud-init inside the fingerprint,
  // writing the pin would change the fingerprint that was just written, and
  // there would be no fixed point to reach. The implicit Nx edge onto
  // cloud-init exists for task ordering, and the bundle is what this reads.
  it('leave cloud-init out, which is what lets the pin ever be right', () => {
    expect(companionSources().filter((path) => path.startsWith('deploy/cloud-init/'))).toEqual([]);
  });

  it('are the first-party files of the four projects the bundle inlines', () => {
    const roots = new Set(companionSources().map((path) => path.split('/').slice(0, 2).join('/')));

    expect([...roots].sort()).toEqual([
      'deploy/companion',
      'libs/agent-protocol',
      'libs/scaleway-storage',
      'libs/session',
    ]);
  });
  it('cover the lockfile and the Dockerfile, which decide the image past our own sources', () => {
    const covered = companionFiles();

    expect(covered).toContain('package-lock.json');
    expect(covered).toContain('deploy/companion/Dockerfile');
  });
});
