import { DEFAULT_SETTINGS, type Game, type JoinInfo } from '@beacon/session';
import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';
import { emulatorsOnly } from './emulator-guard.js';
import { PERSONAS } from './personas.js';

/**
 * The screens of the board, by the name one asks for them — not by the state
 * they write. Two of them, `running` and `expiring`, are the same state: what
 * separates them is whether the extension button is clickable, and that is a
 * screen, not a state.
 */
export const SCREENS = [
  'idle',
  'preparing',
  'running',
  'running-sunkenland',
  'expiring',
  'closing',
  'failed',
  'unreadable',
] as const;

export type Screen = (typeof SCREENS)[number];

export function isScreen(value: string): value is Screen {
  return (SCREENS as readonly string[]).includes(value);
}

const OWNER = PERSONAS.find((persona) => persona.uid === 'dev-player')?.uid ?? 'dev-player';

const JOIN: Readonly<Record<Game, JoinInfo>> = {
  enshrouded: {
    game: 'enshrouded',
    hostname: 'enshrouded.beacon.charlouze.com',
    address: '51.15.42.7',
    port: 15637,
  },
  sunkenland: {
    game: 'sunkenland',
    serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~1757102400',
    region: 'eu',
    worldName: "Beacon's World",
  },
};

/**
 * `server/current` as it would stand if that screen were showing.
 *
 * Whole documents, never patches, and every screen writes the same keys. A
 * patch would leave a running session's ip under an IDLE state — the very
 * incoherence the watchdog exists to correct, staged by hand in the database
 * it watches.
 *
 * `now` is a parameter and not `new Date()` because the deadlines are what the
 * screens differ by, and a fixture whose output moves on its own cannot be
 * asserted on.
 */
export function screenFixture(screen: Screen, now: Date): Record<string, unknown> {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const ahead = (ms: number) => new Date(now.getTime() + ms);

  const blank = {
    state: 'IDLE' as string,
    stateSince: ago(30 * 60_000),
    sessionId: null as string | null,
    startedBy: null as string | null,
    startedAt: null as Date | null,
    deadline: null as Date | null,
    game: null as Game | null,
    instanceId: null as string | null,
    ipId: null as string | null,
    ip: null as string | null,
    joinInfo: null as JoinInfo | null,
    provisionClaimedAt: null as Date | null,
    lastError: null as string | null,
    instanceSize: null as string | null,
  };

  const opened = {
    ...blank,
    sessionId: 'dev-session-0001',
    startedBy: OWNER,
    startedAt: ago(90 * 60_000),
    deadline: ahead(DEFAULT_SETTINGS.sessionDurationMs - 90 * 60_000),
    game: 'enshrouded' as Game,
    instanceSize: DEFAULT_SETTINGS.defaultInstanceSize,
  };

  const live = {
    ...opened,
    state: 'RUNNING',
    stateSince: ago(80 * 60_000),
    instanceId: 'dev-instance',
    ipId: 'dev-ip',
    ip: '51.15.42.7',
    joinInfo: JOIN.enshrouded,
  };

  switch (screen) {
    case 'idle':
      return blank;

    // Claimed, because that is what PROVISIONING means to the function: the
    // claim lock is taken and no second pass will spend money on it.
    case 'preparing':
      return {
        ...opened,
        state: 'PROVISIONING',
        stateSince: ago(40_000),
        provisionClaimedAt: ago(40_000),
      };

    case 'running':
      return live;

    case 'running-sunkenland':
      return { ...live, game: 'sunkenland', joinInfo: JOIN.sunkenland };

    // Ten minutes left, inside the thirty-minute window: the one moment the
    // product is actually about.
    case 'expiring':
      return { ...live, deadline: ahead(10 * 60_000) };

    case 'closing':
      return { ...live, state: 'STOPPING', stateSince: ago(20_000) };

    // No references and no join point: what is left after a provisioning that
    // never produced a machine.
    case 'failed':
      return {
        ...opened,
        state: 'FAILED',
        stateSince: ago(5 * 60_000),
        lastError: 'no capacity for DEV1-L in fr-par-1 (staged by `mise run screen`)',
      };

    // A word no vocabulary in this repository knows — not a missing document.
    // The board has a row for it, and this is the only way to see it.
    case 'unreadable':
      return { ...live, state: 'CATCHING_FIRE' };
  }
}

export async function screen(name: string, now: Date): Promise<void> {
  emulatorsOnly('screen');

  if (!isScreen(name)) {
    throw new Error(`no screen named "${name}". There is: ${SCREENS.join(', ')}`);
  }

  await getFirestore(defaultApp()).doc('server/current').set(screenFixture(name, now));
  console.log(`server/current now shows "${name}" — the open tab follows without a reload`);
}
