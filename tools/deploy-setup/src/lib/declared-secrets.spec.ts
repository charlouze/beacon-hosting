import { readFileSync } from 'node:fs';
import { CONTAINER, secretsDeclaredIn } from './declared-secrets.js';

describe('secretsDeclaredIn', () => {
  it('names every defineSecret, in the order the source declares them', () => {
    const source = `
      import { defineSecret, defineString } from 'firebase-functions/params';
      export const SCW_SECRET_KEY = defineSecret('SCW_SECRET_KEY');
      export const SCW_ACCESS_KEY = defineString('SCW_ACCESS_KEY');
      export const DYNHOST_PASSWORD =
        defineSecret('DYNHOST_PASSWORD');
    `;

    expect(secretsDeclaredIn(source)).toEqual([
      'SCW_SECRET_KEY',
      'DYNHOST_PASSWORD',
    ]);
  });

  it('refuses a source that declares none, rather than asking for nothing', () => {
    expect(() => secretsDeclaredIn('export const nothing = 1;')).toThrow(
      /aucun defineSecret/,
    );
  });

  // The whole point of reading the source instead of holding a list: the two
  // drifted apart once already, in `tools/dev-secrets.mjs`, and the gap only
  // showed up as an emulator failing to authenticate minutes into a session.
  it('reads the five the functions actually declare', () => {
    expect(secretsDeclaredIn(readFileSync(CONTAINER, 'utf8'))).toEqual([
      'SCW_SECRET_KEY',
      'SERVER_PASSWORD',
      'DYNHOST_USER',
      'DYNHOST_PASSWORD',
      'S3_SECRET_KEY',
    ]);
  });
});
