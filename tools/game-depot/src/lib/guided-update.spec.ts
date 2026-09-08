import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ObjectApi } from '@beacon/scaleway-storage';
import type { AdminCredentials } from './admin-credentials.js';
import { SERVER_BINARY, gameArchiveKeyFor } from './game-depot.js';
import { inMemoryFiles } from './local-files.spec-helper.js';
import { type GuidedUpdatePorts, runGuidedUpdate } from './guided-update.js';

const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
const SERVER_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland Dedicated Server');
const CLIENT_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland');

const ADMIN_SECRET = 'the-admin-secret-nothing-may-ever-print';
const MACHINE_SECRET = 'the-machine-secret-that-cannot-write';

const DUMP_WITH_BOTH_REMOTES = JSON.stringify({
  'scw-machine': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'MACHINE-ACCESS-KEY',
    secret_access_key: MACHINE_SECRET,
  },
  'scw-admin': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'ADMIN-ACCESS-KEY',
    secret_access_key: ADMIN_SECRET,
  },
});

const LOGIN_USERS_VDF = `"users"
{
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t\t"MostRecent"\t\t"1"
\t}
}
`;

/**
 * The ordinary state of a Steam client signed into more than one account:
 * neither carries `MostRecent` nor `AutoLogin`. The first one found is still
 * handed over so the printed line stays pasteable, but the message must say
 * plainly that it is a coin flip between the two.
 */
const LOGIN_USERS_TWO_UNFLAGGED = `"users"
{
\t"76561190000000001"
\t{
\t\t"AccountName"\t\t"an-old-account"
\t}
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t}
}
`;

/** A machine where Steam is logged in and the *client* is installed. */
function steamWithoutTheServer(): Record<string, number | string> {
  return {
    [join(DEFAULT_STEAM, 'config', 'loginusers.vdf')]: LOGIN_USERS_VDF,
    [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
  };
}

function steamWithTheServer(): Record<string, number | string> {
  return {
    ...steamWithoutTheServer(),
    [join(SERVER_DIR, SERVER_BINARY)]: 60_000_000,
    [join(SERVER_DIR, 'Sunkenland_Data', 'data.pak')]: 2_240_000_000,
  };
}

interface Harness {
  readonly said: string[];
  readonly asked: string[];
  readonly opened: AdminCredentials[];
  readonly bucket: Map<string, number>;
  readonly ports: GuidedUpdatePorts;
}

function harness(options: {
  readonly tree?: Record<string, number | string>;
  readonly configDump?: string;
  readonly installDir?: string;
  readonly answer?: (question: string, tree: Record<string, number | string>) => boolean;
}): Harness {
  const tree = options.tree ?? steamWithTheServer();
  const said: string[] = [];
  const asked: string[] = [];
  const opened: AdminCredentials[] = [];
  const bucket = new Map<string, number>();

  const api: ObjectApi = {
    async list(prefix: string) {
      return [...bucket]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, sizeBytes]) => ({ key, sizeBytes, lastModified: new Date(0) }));
    },
    async put() {
      throw new Error('the guided flow deposits through pushGameFiles, never through put');
    },
    async get() {
      throw new Error('the guided flow downloads nothing');
    },
  };

  return {
    said,
    asked,
    opened,
    bucket,
    ports: {
      game: 'sunkenland',
      bucketName: 'beacon-games',
      steamRoot: DEFAULT_STEAM,
      installDir: options.installDir,
      files: inMemoryFiles(tree),
      rcloneConfigDump: async () => options.configDump ?? DUMP_WITH_BOTH_REMOTES,
      openBucket: (credentials) => {
        opened.push(credentials);
        return api;
      },
      pushArchive: async ({ game }) => {
        bucket.set(gameArchiveKeyFor(game), 2_480_000_000);
      },
      ask: async (question) => {
        asked.push(question);
        return options.answer?.(question, tree) ?? true;
      },
      say: (line) => said.push(line),
    },
  };
}

describe('when the dedicated server is not installed', () => {
  it('hands over the exact steamcmd command instead of failing', async () => {
    const flow = harness({ tree: steamWithoutTheServer(), answer: () => false });
    const outcome = await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');

    expect(outcome).toBe('not-installed');
    expect(printed).toContain('steamcmd +force_install_dir "');
    expect(printed).toContain('+app_update 2667530 validate +quit');
    // Discovered, so the line is one to paste rather than one to edit.
    expect(printed).toContain('+login the-one-who-owns-the-game +app_update');
  });

  // The two things that cost an evening each, and neither is visible in the
  // command itself: an ignored install folder, and a password in the history.
  it('says why the option order matters, and why no password goes on the line', async () => {
    const flow = harness({ tree: steamWithoutTheServer(), answer: () => false });
    await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');

    expect(printed).toMatch(/\+force_install_dir[\s\S]*before[\s\S]*\+login/);
    expect(printed).toMatch(/password/i);
  });

  // The fixture's account is flagged by MostRecent, so it is a real answer
  // from the Steam client, not a coin flip — the message must not call it a
  // guess, and must still say how to override it.
  it('says how to name another account, without calling a flagged pick a guess', async () => {
    const flow = harness({ tree: steamWithoutTheServer(), answer: () => false });
    await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');
    expect(printed).toContain('--steam-account=');
    expect(printed).toMatch(/is the one the Steam client itself/i);
    expect(printed).not.toMatch(/none flagged as logged in/i);
  });

  // The real case this machine hit: two accounts, and nothing flags either.
  // Silently taking the first would be indistinguishable from a real pick, so
  // the message must say the pick is a coin flip, only when it truly is one.
  it('says it took the first of several accounts, only because none is flagged', async () => {
    const flow = harness({
      tree: { ...steamWithoutTheServer(), [join(DEFAULT_STEAM, 'config', 'loginusers.vdf')]: LOGIN_USERS_TWO_UNFLAGGED },
      answer: () => false,
    });
    await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');
    expect(printed).toMatch(/2 accounts are in the/i);
    expect(printed).toMatch(/none flagged as logged in/i);
    expect(printed).toContain('+login an-old-account +app_update');
  });

  it('deposits nothing, having found nothing to deposit', async () => {
    const flow = harness({ tree: steamWithoutTheServer(), answer: () => false });
    await runGuidedUpdate(flow.ports);
    expect(flow.bucket.size).toBe(0);
  });

  // The point of guiding rather than failing: the operator runs steamcmd in
  // another window and comes back to a flow that is still waiting.
  it('picks the flow back up once the operator has run it', async () => {
    const flow = harness({
      tree: steamWithoutTheServer(),
      answer: (question, tree) => {
        if (/re-check/i.test(question)) tree[join(SERVER_DIR, SERVER_BINARY)] = 2_300_000_000;
        return true;
      },
    });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.bucket.has('sunkenland/game.tar')).toBe(true);
  });
});

describe('what it says it found before it deposits anything', () => {
  it('names the folder, its weight and its file count', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');

    expect(printed).toContain(SERVER_DIR);
    expect(printed).toContain('2 files');
    expect(printed).toMatch(/2\.\d\d GB/);
  });

  // 8 GB is the client. Depositing it costs a transfer and an evening of doubt
  // over the one set of files nobody can rebuild without the Steam account.
  // Matched on the warning's own wording, not on "client" alone: that word is
  // also in the fixed step-2 title, which any run prints regardless of size.
  it('warns when the folder weighs what the client weighs', async () => {
    const flow = harness({ installDir: CLIENT_DIR, tree: { ...steamWithTheServer(), [join(CLIENT_DIR, SERVER_BINARY)]: 1_000 } });
    await runGuidedUpdate(flow.ports);
    const printed = flow.said.join('\n');
    expect(printed).toMatch(/far past the 2\.3 GB a dedicated server weighs/i);
    expect(printed).toContain('the 8 GB game client');
  });

  // The counterpart to the test above: a folder at the size a server actually
  // is must stay quiet about it, or the warning is not a warning at all.
  it('stays quiet about the client weight for a folder that weighs what a server weighs', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);
    expect(flow.said.join('\n')).not.toMatch(/far past the 2\.3 GB/i);
  });

  it('refuses a folder given by hand that holds no server binary', async () => {
    const flow = harness({ installDir: CLIENT_DIR });
    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.said.join('\n')).toContain(SERVER_BINARY);
    expect(flow.bucket.size).toBe(0);
  });
});

describe('the deposit', () => {
  it('reads back what the bucket then holds, and announces it', async () => {
    const flow = harness({});
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.said.join('\n')).toContain('sunkenland/game.tar');
    expect(flow.said.join('\n')).toContain('2.31 GB');
  });

  // The machine's key can only read this bucket (§7). Taking it would fail at
  // the end of a multi-gigabyte upload rather than before it starts.
  it('opens the bucket with the administrator key, never the machine one', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);
    expect(flow.opened.map((credentials) => credentials.accessKeyId)).toEqual(['ADMIN-ACCESS-KEY']);
  });

  // Told apart from a refusal on purpose: an operator who answers no has been
  // served, and a task runner that paints that red teaches him to ignore red.
  it('deposits nothing when the operator declines, and calls that neither a failure nor a deposit', async () => {
    const flow = harness({ answer: (question) => !/deposit/i.test(question) });
    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(flow.bucket.size).toBe(0);
  });

  // §8, and the reason this tool exists at all: it has no verb that removes.
  // The objects of the older file-by-file deposit outlive every run of it.
  it('says what it deliberately left alone', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);
    expect(flow.said.join('\n')).toMatch(/deleted/i);
  });
});

describe('the credentials', () => {
  it('names the missing remote and stops, rather than starting an upload that cannot sign', async () => {
    const flow = harness({ configDump: JSON.stringify({ 'scw-machine': {} }) });
    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.said.join('\n')).toContain('scw-admin');
    expect(flow.bucket.size).toBe(0);
  });

  // Explicit rather than implicit: the flow reads a secret out of rclone on
  // every run, and the run happens in a terminal whose scrollback is shared in
  // a chat the day something goes wrong.
  it('lets no part of a credential reach the output', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);
    const everything = [...flow.said, ...flow.asked].join('\n');

    expect(everything).not.toContain(ADMIN_SECRET);
    expect(everything).not.toContain(MACHINE_SECRET);
    expect(everything).not.toContain('ADMIN-ACCESS-KEY');
    expect(everything).not.toContain('MACHINE-ACCESS-KEY');
    // And it did read them, so the assertion above is not passing on an
    // output that never held anything at all.
    expect(flow.opened[0]?.secretAccessKey).toBe(ADMIN_SECRET);
  });
});
