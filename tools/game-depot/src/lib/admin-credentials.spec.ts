import { describe, expect, it } from 'vitest';
import { ADMIN_REMOTE, adminCredentialsFrom, describeRemote } from './admin-credentials.js';

const ADMIN_SECRET = 'the-admin-secret-nothing-may-ever-print';
const MACHINE_SECRET = 'the-machine-secret-that-cannot-write';

/**
 * What `rclone config dump` renders on this machine: both remotes, side by
 * side. The machine one only ever reads the games bucket (§7), so picking the
 * wrong entry fails at the end of a multi-gigabyte upload rather than before it.
 */
const DUMP_WITH_BOTH_REMOTES = JSON.stringify({
  'scw-machine': {
    type: 's3',
    provider: 'Scaleway',
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'MACHINE-ACCESS-KEY',
    secret_access_key: MACHINE_SECRET,
  },
  'scw-admin': {
    type: 's3',
    provider: 'Scaleway',
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'ADMIN-ACCESS-KEY',
    secret_access_key: ADMIN_SECRET,
  },
});

describe('reading the administrator key out of rclone', () => {
  it('takes the admin remote out of a dump that also holds the machine one', () => {
    const credentials = adminCredentialsFrom(DUMP_WITH_BOTH_REMOTES, ADMIN_REMOTE);
    expect(credentials.accessKeyId).toBe('ADMIN-ACCESS-KEY');
    expect(credentials.secretAccessKey).toBe(ADMIN_SECRET);
    expect(credentials.endpoint).toBe('https://s3.fr-par.scw.cloud');
    expect(credentials.region).toBe('fr-par');
  });

  it('names the remote it could not find, rather than failing on a signature later', () => {
    const dump = JSON.stringify({ 'scw-machine': { type: 's3' } });
    expect(() => adminCredentialsFrom(dump, ADMIN_REMOTE)).toThrow(/scw-admin/);
  });

  // A half-filled remote is the same kind of fault as a missing one, and the
  // field name is all the operator needs — its value is never the fix.
  it('names the field a remote is missing, never a value it holds', () => {
    const dump = JSON.stringify({
      'scw-admin': { endpoint: 'https://s3.fr-par.scw.cloud', region: 'fr-par', access_key_id: 'ADMIN-ACCESS-KEY' },
    });
    let message = '';
    try {
      adminCredentialsFrom(dump, ADMIN_REMOTE);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('secret_access_key');
    expect(message).not.toContain('ADMIN-ACCESS-KEY');
  });
});

/**
 * rclone stores what the operator typed, and its s3 backend takes a bare host
 * as https. The aws sdk does not: it wants an absolute url and answers a bare
 * host with `TypeError: Invalid URL`, at the deposit, after the archive is
 * built. Completing here is reading rclone the way rclone reads itself.
 */
describe('the endpoint the sdk will be handed', () => {
  const dumpWithEndpoint = (endpoint: string): string =>
    JSON.stringify({
      'scw-admin': {
        endpoint,
        region: 'fr-par',
        access_key_id: 'ADMIN-ACCESS-KEY',
        secret_access_key: ADMIN_SECRET,
      },
    });

  it('completes a bare host, which is what rclone config stores', () => {
    const credentials = adminCredentialsFrom(dumpWithEndpoint('s3.fr-par.scw.cloud'), ADMIN_REMOTE);
    expect(credentials.endpoint).toBe('https://s3.fr-par.scw.cloud');
  });

  it('leaves an https endpoint exactly as it was written', () => {
    const credentials = adminCredentialsFrom(dumpWithEndpoint('https://s3.fr-par.scw.cloud'), ADMIN_REMOTE);
    expect(credentials.endpoint).toBe('https://s3.fr-par.scw.cloud');
  });

  // A local MinIO is reachable over plain http, and upgrading it would point
  // the deposit at a port that answers nothing.
  it('leaves an http endpoint alone rather than upgrading it', () => {
    const credentials = adminCredentialsFrom(dumpWithEndpoint('http://localhost:9000'), ADMIN_REMOTE);
    expect(credentials.endpoint).toBe('http://localhost:9000');
  });
});

describe('describing the remote to the operator', () => {
  // Where the key comes from is worth saying; the key is not. This line is the
  // one printed on every run, so it is the one that would leak.
  it('says where the key came from without carrying any part of it', () => {
    const described = describeRemote(ADMIN_REMOTE, adminCredentialsFrom(DUMP_WITH_BOTH_REMOTES, ADMIN_REMOTE));
    expect(described).toContain(ADMIN_REMOTE);
    expect(described).toContain('fr-par');
    expect(described).not.toContain(ADMIN_SECRET);
    expect(described).not.toContain('ADMIN-ACCESS-KEY');
  });

  // The operator reads this line to know what was called. Printing what rclone
  // stored, when the deposit was signed against a completed url, would make the
  // only trace of the endpoint disagree with the endpoint.
  it('shows the endpoint the deposit will use, not the one rclone stored', () => {
    const dump = JSON.stringify({
      'scw-admin': {
        endpoint: 's3.fr-par.scw.cloud',
        region: 'fr-par',
        access_key_id: 'ADMIN-ACCESS-KEY',
        secret_access_key: ADMIN_SECRET,
      },
    });
    const described = describeRemote(ADMIN_REMOTE, adminCredentialsFrom(dump, ADMIN_REMOTE));
    expect(described).toContain('https://s3.fr-par.scw.cloud');
  });
});
