import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import {
  Deadline,
  DEFAULT_SETTINGS,
  endedWithoutServer,
  Game,
  gameVersionFrom,
  Session,
  World,
  type GameCopy,
  type GameVersion,
  type PublishedVersion,
} from '@beacon/session';
import {
  adminWorldRecord,
  gameCopyDocPath,
  gameCopyRecord,
  gameCopyStore,
  idleServerDocument,
  serverDocPath,
  setupStores,
  worldStateStores,
} from '@beacon/session-record';
import type { AdminMembershipRecord } from '@beacon/membership-record/admin';
import { adminMembershipRecord, MEMBERS } from '@beacon/membership-record/admin';
import { defaultApp } from './firebase-app.js';
import { runStateChange, type ProvisionDeps } from './provisioning.js';

const NOW = new Date('2026-09-06T20:00:00Z');
const WORLD_ID = 'les-copains';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};
const PUBLISHED = version('25746735');
const BEHIND = version('25700000');

const provisioningSession = (sessionId: string, worldId: string, game: Game) =>
  Session.from({
    state: 'PROVISIONING',
    sessionId,
    worldId,
    game,
    startedBy: 'u1',
    startedAt: NOW,
    deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: false,
  });

const provisioning = () => provisioningSession('s1', WORLD_ID, 'enshrouded');

const stopping = () => Session.from({ ...fieldsOf(provisioning()), state: 'STOPPING' });

/** The one game whose cloud-init carries the declared steam ids at all. */
const provisioningSunkenland = () => provisioningSession('s1', WORLD_ID, 'sunkenland');

const defaultWorld = (): World =>
  World.from({
    worldId: WORLD_ID,
    game: 'enshrouded',
    name: 'Les copains',
    inviteCode: 'c',
    players: ['u1'],
  });

interface FakeDepsOptions {
  readonly world?: World;
  readonly members?: Partial<AdminMembershipRecord>;
}

/**
 * One fake `ProvisionDeps`, built afresh for each test so that a mutation in
 * one never leaks into the next. `world` and `members` are the two knobs the
 * suite turns; everything else keeps a default that answers the happy path.
 */
const fakeDeps = (options: FakeDepsOptions = {}): ProvisionDeps => {
  const state = {
    claimProvisioning: vi.fn(async () => true),
    applyIf: vi.fn(async () => false),
    publish: vi.fn(async () => undefined),
    apply: vi.fn(async () => undefined),
    read: vi.fn(async () => null),
    readSession: vi.fn(async (): Promise<Session | null> => provisioning()),
  };
  const setup = {
    begin: vi.fn(async () => true),
    advance: vi.fn(async () => null),
    read: vi.fn(async () => null),
  };
  return {
    clock: { now: () => NOW },
    host: {
      open: vi.fn(async () => ({
        address: '51.15.42.7',
        size: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      })),
      close: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      sweepUnclaimed: vi.fn(async () => ({ destroyed: [], stranded: [], errors: [] })),
    },
    // The same object every call: a test that grabs it via `deps.states.for(...)`
    // and mutates one of its methods reaches the very instance `provision` uses.
    states: { for: vi.fn(() => state), all: vi.fn(async () => [WORLD_ID]) },
    setups: { for: vi.fn(() => setup) },
    settings: { read: vi.fn(async () => DEFAULT_SETTINGS) },
    ledger: {
      open: vi.fn(async () => undefined),
      record: vi.fn(async () => undefined),
      read: vi.fn(async () => null),
      close: vi.fn(async () => undefined),
      openSessions: vi.fn(async () => []),
      worldOf: vi.fn(async () => null),
    },
    serverPassword: () => 'hunter2',
    members: { declaredSteamIds: vi.fn(async () => []), ...options.members },
    tokens: { issue: vi.fn(async () => undefined), verify: vi.fn(async () => false) },
    agentEndpoint: async () => 'https://europe-west1-beacon.cloudfunctions.net/agentReport',
    saveKeys: () => ({
      endpoint: 'https://s3.fr-par.scw.cloud',
      region: 'fr-par',
      savesBucket: 'beacon-saves',
      gamesBucket: 'beacon-games',
      accessKey: 'SCWXXXXXXXXXXXXXXXXX',
      secretKey: 's3cr3t',
    }),
    worlds: {
      read: vi.fn(async () => options.world ?? defaultWorld()),
      create: vi.fn(async () => undefined),
    },
    journal: { failure: vi.fn(), setupChanged: vi.fn(), discarded: vi.fn() },
    publisher: {
      publishedVersion: vi.fn(async (): Promise<PublishedVersion> => ({ readable: true, version: PUBLISHED })),
    },
    gameCopies: {
      read: vi.fn(async (): Promise<GameCopy | null> => ({ version: PUBLISHED, depositedAt: NOW })),
      recordPublished: vi.fn(async () => undefined),
    },
  };
};

let deps: ProvisionDeps;

beforeEach(() => {
  deps = fakeDeps();
});

describe('provisioning', () => {
  it('keeps the first step from the instant the preflight check passed', async () => {
    const passed = new Date(NOW.getTime() + 2_000);
    const now = vi.fn(() => passed).mockReturnValueOnce(NOW);
    deps = { ...deps, clock: { now } };

    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.setups.for).toHaveBeenCalledWith(WORLD_ID);
    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledWith(
      's1',
      ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      passed,
    );
  });

  it('begins the setup of the other game with its own order', async () => {
    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledWith(
      's1',
      ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      NOW,
    );
  });

  it('begins no setup for a session it did not claim', async () => {
    vi.mocked(deps.states.for(WORLD_ID).claimProvisioning).mockResolvedValue(false);

    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
  });

  // The first step kept is what ends the preflight check: no step, no server.
  it('calls no provider when the first step could not be kept, and journals why', async () => {
    vi.mocked(deps.setups.for(WORLD_ID).begin).mockRejectedValue(new Error('firestore is down'));

    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(false);

    expect(deps.tokens.issue).not.toHaveBeenCalled();
    expect(deps.ledger.open).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.begin',
      sessionId: 's1',
      error: 'Error: firestore is down',
    });
  });

  describe('a session closed during its preflight check', () => {
    it('ends it without a server when it was closed before the first step was kept', async () => {
      const state = deps.states.for(WORLD_ID);
      vi.mocked(deps.setups.for(WORLD_ID).begin).mockResolvedValue(false);
      vi.mocked(state.readSession).mockResolvedValue(stopping());
      vi.mocked(state.applyIf).mockResolvedValue(true);

      expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(true);

      expect(state.applyIf).toHaveBeenCalledWith(
        { sessionId: 's1', state: 'STOPPING' },
        endedWithoutServer(stopping()),
        NOW,
      );
      expect(deps.tokens.issue).not.toHaveBeenCalled();
      expect(deps.ledger.open).not.toHaveBeenCalled();
      expect(deps.host.open).not.toHaveBeenCalled();
      expect(state.apply).not.toHaveBeenCalled();
    });

    it('stops when the world moved on to another session meanwhile', async () => {
      const state = deps.states.for(WORLD_ID);
      vi.mocked(deps.setups.for(WORLD_ID).begin).mockResolvedValue(false);
      vi.mocked(state.readSession).mockResolvedValue(provisioningSession('s2', WORLD_ID, 'enshrouded'));

      await runStateChange(deps, WORLD_ID, provisioning());

      expect(state.applyIf).not.toHaveBeenCalled();
      expect(deps.host.open).not.toHaveBeenCalled();
    });
  });

  // §6 étape 3, §8: triggers are delivered at least once. Without the claim, a
  // double delivery creates two billed machines.
  it('does nothing at all when another delivery already claimed it', async () => {
    deps.states.for(WORLD_ID).claimProvisioning = vi.fn(async () => false);
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.ledger.open).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
  });

  // The order that protects the budget: the intent exists before anything is
  // billed, so a crash right after `open()` still leaves something to reap.
  it('writes the intent before it calls the provider', async () => {
    const order: string[] = [];
    deps.ledger.open = vi.fn(async () => void order.push('intent'));
    deps.host.open = vi.fn(async () => {
      order.push('provider');
      return { address: '51.15.42.7', size: 'DEV1-L', references: { instanceId: 'srv-1', ipId: 'ip-1' } };
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(order).toEqual(['intent', 'provider']);
  });

  it('hands the provider the cloud-init the catalogue rendered', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());
    const request = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.bootstrap).toContain('#cloud-config');
    expect(request.bootstrap).toContain('SERVER_PASSWORD=hunter2');
    expect(request.sessionId).toBe('s1');
    expect(request.size).toBe('DEV1-L');
    expect(deps.states.for).toHaveBeenCalledWith(WORLD_ID);
  });

  // The heart of this tranche. RUNNING means the join point is published, and
  // §6 makes the agent the one who knows it — the function knew only that an ip
  // had been reserved, which is why RUNNING lied for five to eight minutes.
  it('leaves the state in PROVISIONING, and publishes nothing', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).publish).not.toHaveBeenCalled();
  });

  // §6 étape 4: the token is issued in the same breath as the intent, before
  // anything is created. A machine that booted before its token existed would
  // report into a 401 and never be able to say it is ready.
  it('issues the session token before it calls the provider', async () => {
    const order: string[] = [];
    deps.tokens.issue = vi.fn(async () => void order.push('token'));
    deps.ledger.open = vi.fn(async () => void order.push('intent'));
    deps.host.open = vi.fn(async () => {
      order.push('provider');
      return {
        address: '51.15.42.7',
        size: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      };
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(order).toEqual(['token', 'intent', 'provider']);
  });

  it('hands the machine a token, and never the same one twice', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());
    const first = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0].bootstrap;
    expect(first).toMatch(/BEACON_TOKEN=[0-9a-f]{64}/);

    await runStateChange(deps, WORLD_ID, provisioning());
    const second = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[1][0].bootstrap;
    expect(tokenIn(second)).not.toBe(tokenIn(first));
  });

  // The crux of this tranche: the token the control plane holds and the token
  // the machine boots with must be the same value. An implementation that
  // issued one token and sowed another would leave every other test here
  // green, and the machine's first report would meet a 401 it can never
  // recover from — twenty-five minutes in PROVISIONING for nothing.
  it('issues the very token it sows, not merely a token', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());
    const bootstrap = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0].bootstrap;
    expect(deps.tokens.issue).toHaveBeenCalledWith('s1', tokenIn(bootstrap), NOW);
  });

  // The intent still carries what the provider answered — the watchdog compares
  // against it, and agentReport publishes from it.
  it('records what the provider answered, address included', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.ledger.record).toHaveBeenCalledWith('s1', {
      instanceId: 'srv-1',
      ipId: 'ip-1',
      ip: '51.15.42.7',
    });
  });

  // §5, §8: an ordinary refusal is not FAILED. Clean up, say why, and the
  // button is clickable again immediately.
  it('cleans up and returns to IDLE when the provider refuses', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    // Precisely where a pass has work to do: a boot that failed is retried at
    // once rather than waiting out the schedule.
    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(true);
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'IDLE', clearFacts: true }),
      NOW,
    );
    expect(deps.states.for).toHaveBeenCalledWith(WORLD_ID);
    expect(deps.ledger.close).toHaveBeenCalledWith('s1', NOW);
  });

  // FAILED is for exactly one case: a cleanup that could not be guaranteed.
  it('goes to FAILED when the cleanup itself fails', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.host.close = vi.fn(async () => {
      throw new Error('api unreachable');
    });
    // A cleanup that could not be guaranteed is exactly when a pass must run
    // again — the resource may still be billed, and nothing else will retry.
    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(true);
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', clearFacts: false }),
      NOW,
    );
    // The intent stays open: something is still billed, and closing it would
    // hide the resources from the reconciliation that has to find them.
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });

  it('gives the session whose setup the refusal abandons', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'IDLE', abandonedSetup: { sessionId: 's1', cause: null } }),
      NOW,
    );
  });

  it('gives it too when the cleanup fails', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.host.close = vi.fn(async () => {
      throw new Error('api unreachable');
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', abandonedSetup: { sessionId: 's1', cause: null } }),
      NOW,
    );
  });

  // The cleanup can last half a minute, and the world does not wait for it.
  it('writes nothing when the world moved on to another session during the cleanup', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.states.for(WORLD_ID).readSession = vi.fn(async () =>
      provisioningSession('s2', WORLD_ID, 'enshrouded'),
    );
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.states.for(WORLD_ID).apply).not.toHaveBeenCalled();
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });

  it('writes nothing when a member closed the session during the cleanup', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.states.for(WORLD_ID).readSession = vi.fn(async () => stopping());
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).not.toHaveBeenCalled();
  });

  // The register, not a double: what this tranche changes is that `members`
  // decides who administers a server in the game, and a stub would only prove
  // that a method was called. Seeded through the Admin SDK, like every other
  // suite here — the rules do not apply to a Function.
  describe('the steam ids the game is told about', () => {
    const db = getFirestore(defaultApp());

    const clearMembers = async (): Promise<void> => {
      const existing = await db.collection(MEMBERS).get();
      await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
    };

    beforeEach(async () => {
      await clearMembers();
      deps = { ...fakeDeps(), members: adminMembershipRecord(db) };
    });

    // And after, which matters more: `immediate-pass.spec.ts` builds a real
    // admin face too, over the same emulator, and expects no administrator at
    // all. A member left behind here would arm it an in-game admin depending
    // on the order the files ran in — the shape of red that shows up once in
    // three runs and costs a day.
    afterEach(clearMembers);

    // A `player`, and that is the point: §2 gives the in-game administrator
    // role to every member. What reaches the cloud-init is a member's declared
    // identifier, never a Beacon role. `alice` must be one of the world's
    // players (§4 delimits the world to them): `defaultWorld` names `u1` alone.
    //
    // The identifier and not the form it travels in: how a game is told about
    // its admins is the catalogue's business, and its own suite pins it.
    it('names any member who declared an identifier', async () => {
      await db.doc(`${MEMBERS}/u1`).set({ role: 'player', steamId: '76561197965918116' });

      await runStateChange(deps, WORLD_ID, provisioningSunkenland());

      expect(bootstrapOf(deps)).toContain('76561197965918116');
    });

    // A steam id is seventeen digits standing alone, and nothing else in a
    // bootstrap is: none may appear when no member declared one.
    it('names nobody when nobody declared an identifier', async () => {
      await db.doc(`${MEMBERS}/u1`).set({ role: 'player' });

      await runStateChange(deps, WORLD_ID, provisioningSunkenland());

      expect(bootstrapOf(deps)).not.toMatch(/\b[0-9]{17}\b/);
    });

    // §4 delimits a world to its players: a member outside the world's roster
    // must not become an in-game admin on it, however declared their identifier is.
    it('never names a member who is not one of the world players', async () => {
      await db.doc(`${MEMBERS}/u1`).set({ role: 'player', steamId: '76561197965918116' });
      await db.doc(`${MEMBERS}/stranger`).set({ role: 'player', steamId: '76561197965918117' });

      await runStateChange(deps, WORLD_ID, provisioningSunkenland());

      expect(bootstrapOf(deps)).toContain('76561197965918116');
      expect(bootstrapOf(deps)).not.toContain('76561197965918117');
    });
  });

  // The heart of this tranche: the world descends all the way to the
  // provider request and the cloud-init, and the players it hands `members`
  // are its own — never the whole register.
  it('renders the cloud-init with the world, and only its players as in-game admins', async () => {
    const world = World.from({
      worldId: WORLD_ID,
      game: 'sunkenland',
      name: 'Les copains',
      inviteCode: 'c',
      players: ['u1', 'u2'],
    });
    const declaredSteamIds = vi.fn(async (among: readonly string[]) =>
      among.map((uid) => `7656119${uid.slice(1)}`),
    );
    deps = fakeDeps({ world, members: { declaredSteamIds } });

    await runStateChange(deps, WORLD_ID, provisioningSession('s1', WORLD_ID, 'sunkenland'));

    expect(deps.worlds.read).toHaveBeenCalledWith(WORLD_ID);
    expect(declaredSteamIds).toHaveBeenCalledWith(['u1', 'u2']);
    const request = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Not `toEqual` against a plain object: `world` is the domain's own
    // `World` (§4), and `OpenServerRequest.world` carries the very instance
    // `deps.worlds.read` answered — the same object, not a copy of its shape.
    expect(request.world).toBe(world);
    expect(request.world.worldId).toBe(WORLD_ID);
    expect(request.world.game).toBe('sunkenland');
    expect(request.world.name).toBe('Les copains');
    expect(request.bootstrap).toContain('BEACON_WORLD=les-copains');
  });

  it('records the world in the intent before calling the provider', async () => {
    await runStateChange(deps, WORLD_ID, provisioningSession('s1', WORLD_ID, 'enshrouded'));
    expect(deps.ledger.open).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ worldId: WORLD_ID }),
      expect.any(Date),
    );
  });

  // `server/current.lastError` is read by every member's browser, live —
  // nothing proves the provider's SDK keeps a cloud-init's secret out of an
  // error's text.
  describe('what reaches the client-readable field', () => {
    const secret = 'a'.repeat(64);

    it('redacts anything long enough to be a credential out of lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.lastError).not.toContain(secret);
      expect(applied.lastError).toContain('[redacted]');
    });

    it('keeps the secret out of the journalled event, and the whole failure in the platform journal', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.events[0].type).toBe('ProvisioningFailed');
      expect(applied.events[0].detail).not.toContain(secret);
      expect(applied.events[0].detail).toContain('[redacted]');
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'provisioning.setup',
        sessionId: 's1',
        error: `Error: user data rejected: BEACON_TOKEN=${secret}`,
      });
    });

    it('keeps a refused cleanup out of both events and of lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      deps.host.close = vi.fn(async () => {
        throw new Error(`could not destroy: SCW_SECRET_KEY=${secret}`);
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.state).toBe('FAILED');
      expect(applied.lastError).not.toContain(secret);
      expect(applied.events.map((event: { type: string }) => event.type)).toEqual([
        'ProvisioningFailed',
        'CleanupFailed',
      ]);
      for (const event of applied.events) expect(event.detail).not.toContain(secret);
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'provisioning.cleanup',
        sessionId: 's1',
        error: `Error: could not destroy: SCW_SECRET_KEY=${secret}`,
      });
      expect(deps.journal.failure).toHaveBeenCalledTimes(2);
    });

    it('truncates a very long lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error('refused '.repeat(200));
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.lastError.length).toBeLessThan(600);
    });
  });
});

describe('the preflight check', () => {
  const failingWith = async (outcome: Partial<Pick<ProvisionDeps, 'publisher' | 'gameCopies'>>) => {
    const failing: ProvisionDeps = { ...deps, ...outcome };
    vi.mocked(failing.states.for(WORLD_ID).applyIf).mockResolvedValue(true);
    await runStateChange(failing, WORLD_ID, provisioningSunkenland());
    return failing;
  };

  const expectNothingAsked = (asked: ProvisionDeps) => {
    expect(asked.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
    expect(asked.tokens.issue).not.toHaveBeenCalled();
    expect(asked.ledger.open).not.toHaveBeenCalled();
    expect(asked.host.open).not.toHaveBeenCalled();
    expect(asked.host.close).not.toHaveBeenCalled();
  };

  it('reads nothing for a game that goes through no copy', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.publisher.publishedVersion).not.toHaveBeenCalled();
    expect(deps.gameCopies.read).not.toHaveBeenCalled();
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('reads nothing when another delivery already claimed the session', async () => {
    vi.mocked(deps.states.for(WORLD_ID).claimProvisioning).mockResolvedValue(false);

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.publisher.publishedVersion).not.toHaveBeenCalled();
  });

  it('keeps the first step and opens when the copy is at the published version, and records what it read', async () => {
    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.publisher.publishedVersion).toHaveBeenCalledWith('sunkenland');
    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', PUBLISHED);
    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledOnce();
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('abandons with the cause, and asks nothing of anyone, when the copy is behind', async () => {
    const failing = await failingWith({
      gameCopies: { ...deps.gameCopies, read: vi.fn(async () => ({ version: BEHIND, depositedAt: NOW })) },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      { sessionId: 's1', state: 'PROVISIONING' },
      expect.objectContaining({ state: 'IDLE', abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } }),
      NOW,
    );
    expectNothingAsked(failing);
  });

  it('abandons for a copy behind when no copy is recorded', async () => {
    const failing = await failingWith({
      gameCopies: { ...deps.gameCopies, read: vi.fn(async () => null) },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } }),
      NOW,
    );
    expectNothingAsked(failing);
  });

  it('abandons for an unreadable version, journals why, and reads no copy', async () => {
    const failing = await failingWith({
      publisher: {
        publishedVersion: vi.fn(async (): Promise<PublishedVersion> => ({
          readable: false,
          cause: 'no answer from Steam within 10000 ms',
        })),
      },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ abandonedSetup: { sessionId: 's1', cause: 'version-unreadable' } }),
      NOW,
    );
    expect(failing.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.preflight',
      sessionId: 's1',
      error: 'no answer from Steam within 10000 ms',
    });
    expect(failing.gameCopies.read).not.toHaveBeenCalled();
    expect(failing.gameCopies.recordPublished).not.toHaveBeenCalled();
    expectNothingAsked(failing);
  });

  it('lets the check decide when recording what it read fails, and journals why', async () => {
    vi.mocked(deps.gameCopies.recordPublished).mockRejectedValue(new Error('firestore is down'));

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.recordPublished',
      sessionId: 's1',
      error: 'Error: firestore is down',
    });
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('treats a copy that cannot be read as an ordinary refusal', async () => {
    vi.mocked(deps.gameCopies.read).mockRejectedValue(new Error('firestore is down'));

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'IDLE',
        lastError: 'Error: firestore is down',
        abandonedSetup: { sessionId: 's1', cause: null },
      }),
      NOW,
    );
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
  });
});

describe('stopping', () => {
  // Closed before the Function claimed it: nothing was asked of anyone.
  it('ends a session that was never claimed, without a server', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(state.applyIf).mockResolvedValue(true);

    expect(await runStateChange(deps, WORLD_ID, stopping())).toBe(true);

    expect(state.applyIf).toHaveBeenCalledWith(
      { sessionId: 's1', state: 'STOPPING', unclaimed: true },
      endedWithoutServer(stopping()),
      NOW,
    );
    expect(deps.host.close).not.toHaveBeenCalled();
  });

  // A claimed session may have a server, and its destruction waits for the
  // agent to report saved (agent-report.ts): nothing here may end it.
  it('leaves a claimed session to the agent and the watchdog', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(state.applyIf).mockResolvedValue(false);

    expect(await runStateChange(deps, WORLD_ID, stopping())).toBe(false);

    expect(deps.host.close).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });
});

// The real stores, because what decides here is the transaction that rereads
// `server/current`; fakes for everything that would reach a provider.
describe('against the emulator', () => {
  const db = getFirestore(defaultApp());
  let live: ProvisionDeps;

  const seedServer = (fields: Record<string, unknown>) =>
    db.doc(serverDocPath(WORLD_ID)).set({ ...idleServerDocument(NOW), ...fields });

  const stoppedEvents = async (sessionId: string) =>
    (
      await db
        .collection('events')
        .where('worldId', '==', WORLD_ID)
        .where('sessionId', '==', sessionId)
        .where('type', '==', 'SessionStopped')
        .get()
    ).docs;

  const clearWorld = async (): Promise<void> => {
    await db.recursiveDelete(db.doc(`worlds/${WORLD_ID}`));
    const events = await db.collection('events').where('worldId', '==', WORLD_ID).get();
    await Promise.all(events.docs.map((doc) => doc.ref.delete()));
  };

  beforeEach(async () => {
    await clearWorld();
    await adminWorldRecord(db).create(defaultWorld(), NOW);
    await seedServer({
      state: 'PROVISIONING',
      sessionId: 's1',
      startedBy: 'u1',
      startedAt: NOW,
      deadline: new Date('2026-09-07T00:00:00Z'),
    });
    live = { ...fakeDeps(), states: worldStateStores(db), setups: setupStores(db) };
  });

  afterEach(clearWorld);

  it('never calls the provider when the session is closed between its claim and its first step', async () => {
    // The member closes it right after the claim, the way the browser writes STOPPING.
    const real = live.states.for(WORLD_ID);
    const claim = real.claimProvisioning.bind(real);
    const closing: ProvisionDeps = {
      ...live,
      states: {
        ...live.states,
        for: () => ({
          ...real,
          claimProvisioning: async (sessionId, at) => {
            const claimed = await claim(sessionId, at);
            await db.doc(serverDocPath(WORLD_ID)).update({ state: 'STOPPING' });
            return claimed;
          },
        }),
      },
    };

    await runStateChange(closing, WORLD_ID, provisioning());

    const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
    expect(server['state']).toBe('IDLE');
    expect(server['provisionClaimedAt']).toBeNull();
    expect(server['abandonedSetup'] ?? null).toBeNull();
    expect(server['lastError'] ?? null).toBeNull();
    expect(live.host.open).not.toHaveBeenCalled();
    expect(live.tokens.issue).not.toHaveBeenCalled();
    expect(live.ledger.open).not.toHaveBeenCalled();
    expect(await setupStores(db).for(WORLD_ID).read()).toBeNull();
    const stopped = await stoppedEvents('s1');
    expect(stopped).toHaveLength(1);
    expect(stopped[0].data()).toEqual(
      expect.objectContaining({ costEuros: 0, detail: 'closed before any server was created' }),
    );
  });

  it('ends a session closed before its claim, without a server', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });

    await runStateChange(live, WORLD_ID, stopping());

    expect((await db.doc(serverDocPath(WORLD_ID)).get()).data()?.['state']).toBe('IDLE');
    const stopped = await stoppedEvents('s1');
    expect(stopped).toHaveLength(1);
    expect(stopped[0].data()).toEqual(
      expect.objectContaining({ costEuros: 0, detail: 'closed before any server was created' }),
    );
  });

  it('forgets what the host said to the opening before', async () => {
    await seedServer({
      state: 'STOPPING',
      sessionId: 's1',
      provisionClaimedAt: null,
      lastError: 'no capacity (left by the session before)',
    });

    await runStateChange(live, WORLD_ID, stopping());

    expect((await db.doc(serverDocPath(WORLD_ID)).get()).data()?.['lastError']).toBeNull();
  });

  it('writes nothing on a second delivery of the same closing', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });
    await runStateChange(live, WORLD_ID, stopping());

    expect(await runStateChange(live, WORLD_ID, stopping())).toBe(false);
    expect(await stoppedEvents('s1')).toHaveLength(1);
  });

  it('leaves alone a session in service that is being closed', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: NOW, ip: '51.15.42.7' });

    expect(await runStateChange(live, WORLD_ID, stopping())).toBe(false);
    expect((await db.doc(serverDocPath(WORLD_ID)).get()).data()?.['state']).toBe('STOPPING');
  });

  describe('for a game that goes through a copy', () => {
    const sunkenlandWorld = (): World =>
      World.from({ worldId: WORLD_ID, game: 'sunkenland', name: 'Les copains', inviteCode: 'c', players: ['u1'] });

    const copies = () => db.doc(gameCopyDocPath('sunkenland'));

    const eventsOf = async (type: string) =>
      (
        await db
          .collection('events')
          .where('worldId', '==', WORLD_ID)
          .where('sessionId', '==', 's1')
          .where('type', '==', type)
          .get()
      ).docs;

    const closeMeanwhile = () => db.doc(serverDocPath(WORLD_ID)).update({ state: 'STOPPING' });

    const answering = (answer: PublishedVersion, before: () => Promise<unknown> = async () => undefined) => ({
      publishedVersion: vi.fn(async () => {
        await before();
        return answer;
      }),
    });

    let copy: ProvisionDeps;

    beforeEach(async () => {
      await clearWorld();
      await copies().delete();
      await adminWorldRecord(db).create(sunkenlandWorld(), NOW);
      await seedServer({
        state: 'PROVISIONING',
        sessionId: 's1',
        startedBy: 'u1',
        startedAt: NOW,
        deadline: new Date('2026-09-07T00:00:00Z'),
      });
      await gameCopyRecord(db).recordDeposit('sunkenland', PUBLISHED);
      copy = {
        ...live,
        worlds: { ...live.worlds, read: vi.fn(async () => sunkenlandWorld()) },
        gameCopies: gameCopyStore(db),
        publisher: answering({ readable: true, version: PUBLISHED }),
      };
    });

    afterEach(async () => {
      await copies().delete();
    });

    const expectAbandonedFor = async (cause: string) => {
      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['provisionClaimedAt']).toBeNull();
      expect(server['lastError'] ?? null).toBeNull();
      expect(server['abandonedSetup']).toEqual(expect.objectContaining({ sessionId: 's1', cause }));
      expect(await eventsOf('ProvisioningFailed')).toHaveLength(1);
      expect(copy.host.open).not.toHaveBeenCalled();
      expect(copy.host.close).not.toHaveBeenCalled();
      expect(copy.tokens.issue).not.toHaveBeenCalled();
      expect(copy.ledger.open).not.toHaveBeenCalled();
      expect(await setupStores(db).for(WORLD_ID).read()).toBeNull();
    };

    const expectEndedWithoutServer = async () => {
      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['abandonedSetup'] ?? null).toBeNull();
      expect(server['lastError'] ?? null).toBeNull();
      expect(await eventsOf('SessionStopped')).toHaveLength(1);
      expect(await eventsOf('ProvisioningFailed')).toHaveLength(0);
      expect(copy.host.open).not.toHaveBeenCalled();
    };

    it('opens when the copy is at the published version, and records what it read', async () => {
      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      expect(copy.host.open).toHaveBeenCalledOnce();
      const recorded = (await copies().get()).data() ?? {};
      expect(recorded['publishedVersion']).toBe(PUBLISHED);
      expect(recorded['publishedReadAt']).toBeDefined();
    });

    it('abandons for a copy behind, without the host', async () => {
      await gameCopyRecord(db).recordDeposit('sunkenland', BEHIND);

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('copy-behind');
    });

    it('abandons for a copy behind when no deposit is recorded', async () => {
      await copies().delete();

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('copy-behind');
    });

    it('abandons for an unreadable version, without the host', async () => {
      copy = { ...copy, publisher: answering({ readable: false, cause: 'no answer' }) };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('version-unreadable');
    });

    it('lets the check decide when recording what it read fails', async () => {
      const real = gameCopyStore(db);
      copy = {
        ...copy,
        gameCopies: { read: real.read, recordPublished: vi.fn(async () => Promise.reject(new Error('down'))) },
      };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      expect(copy.host.open).toHaveBeenCalledOnce();
    });

    it('lets an opening claim after an abandon at the preflight check', async () => {
      await gameCopyRecord(db).recordDeposit('sunkenland', BEHIND);
      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await db.doc(serverDocPath(WORLD_ID)).update({ state: 'PROVISIONING', sessionId: 's2' });

      expect(await worldStateStores(db).for(WORLD_ID).claimProvisioning('s2', NOW)).toBe(true);
    });

    describe('closed during its preflight check', () => {
      it('ends without a server when the check passes', async () => {
        copy = { ...copy, publisher: answering({ readable: true, version: PUBLISHED }, closeMeanwhile) };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });

      // The write of the abandon finds the session closing, and leaves it to end.
      it('ends without a server, and without the mark, when the check fails', async () => {
        copy = { ...copy, publisher: answering({ readable: false, cause: 'no answer' }, closeMeanwhile) };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });

      it('ends without a server, and without an error, when the check ends on an ordinary refusal', async () => {
        copy = {
          ...copy,
          gameCopies: {
            read: vi.fn(async () => {
              await closeMeanwhile();
              throw new Error('firestore is down');
            }),
            recordPublished: vi.fn(async () => undefined),
          },
        };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });
    });

    it('treats a copy that cannot be read as an ordinary refusal', async () => {
      copy = {
        ...copy,
        gameCopies: {
          read: vi.fn(async () => Promise.reject(new Error('firestore is down'))),
          recordPublished: vi.fn(async () => undefined),
        },
      };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['lastError']).toBe('Error: firestore is down');
      expect(server['abandonedSetup']).toEqual(expect.objectContaining({ sessionId: 's1', cause: null }));
      expect(copy.host.open).not.toHaveBeenCalled();
    });
  });
});

describe('what the caller learns', () => {
  it('says it acted when it provisioned', async () => {
    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(true);
  });

  // A double delivery claimed by someone else did nothing, so there is nothing
  // for a pass to look at either.
  it('says it did not act when another delivery had claimed it', async () => {
    deps.states.for(WORLD_ID).claimProvisioning = vi.fn(async () => false);
    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(false);
  });

  // What bounds the loop: a pass writes IDLE, FAILED, RUNNING or STOPPING, and
  // the trigger it fires dies here instead of asking for another pass. A
  // STOPPING a pass writes was claimed, and `stopping` covers it.
  it.each(['IDLE', 'RUNNING', 'FAILED'] as const)(
    'says it did not act on %s',
    async (state) => {
      expect(
        await runStateChange(
          deps,
          WORLD_ID,
          Session.from({ ...fieldsOf(provisioning()), state }),
        ),
      ).toBe(false);
    },
  );
});

describe('every other state', () => {
  it.each(['IDLE', 'RUNNING', 'FAILED'] as const)('does nothing on %s', async (state) => {
    await runStateChange(deps, WORLD_ID, Session.from({ ...fieldsOf(provisioning()), state }));
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.host.close).not.toHaveBeenCalled();
  });
});

/**
 * `Session` keeps its fields private, so a test that needs a variant rebuilds
 * them. Kept here and not exposed on the class: opening a domain object's
 * insides for a test's convenience is how an aggregate becomes a data bag.
 */
const fieldsOf = (session: Session) => ({
  sessionId: session.sessionId as string,
  worldId: session.worldId as string,
  game: session.game as 'enshrouded',
  startedBy: session.startedBy,
  startedAt: NOW,
  deadline: session.deadline,
  instanceSize: session.instanceSize,
  hasJoinInfo: false,
});

const bootstrapOf = (deps: ProvisionDeps): string =>
  (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0].bootstrap;

const tokenIn = (bootstrap: string): string =>
  /BEACON_TOKEN=([0-9a-f]{64})/.exec(bootstrap)?.[1] ?? '';
