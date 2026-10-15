import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '@beacon/session';
import { steamPublisher, type SteamClient } from './steam-publisher.js';

const APP = '2667530';
const appOf = (game: Game): string | null => (game === 'sunkenland' ? APP : null);

const publicBuild = (buildid: unknown) => ({
  apps: { [APP]: { appinfo: { depots: { branches: { public: { buildid } } } } } },
});

interface Behaviour {
  /** What happens once the client is asked to log on. */
  readonly onLogOn: (client: FakeClient) => void;
  readonly productInfo?: () => Promise<unknown>;
}

class FakeClient extends EventEmitter implements SteamClient {
  readonly logOns: unknown[] = [];
  readonly asked: unknown[][] = [];
  logOffs = 0;

  constructor(private readonly behaviour: Behaviour) {
    super();
  }

  logOn(details: { anonymous: true }): void {
    this.logOns.push(details);
    this.behaviour.onLogOn(this);
  }

  logOff(): void {
    this.logOffs += 1;
  }

  getProductInfo(apps: number[], packages: number[], inclTokens: boolean): Promise<unknown> {
    this.asked.push([apps, packages, inclTokens]);
    return this.behaviour.productInfo?.() ?? Promise.reject(new Error('not asked'));
  }
}

const logsOn = (client: FakeClient) => setImmediate(() => client.emit('loggedOn'));

const publisherWith = (behaviour: Behaviour, timeoutMs = 1000) => {
  const clients: FakeClient[] = [];
  const publisher = steamPublisher({
    appOf,
    timeoutMs,
    load: async () => () => {
      const client = new FakeClient(behaviour);
      clients.push(client);
      return client;
    },
  });
  return { publisher, clients };
};

describe('steamPublisher', () => {
  it('reads the build of the public branch, anonymously, then logs off', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('25746735'),
    });

    expect(await publisher.publishedVersion('sunkenland')).toEqual({ readable: true, version: '25746735' });
    expect(clients[0].logOns).toEqual([{ anonymous: true }]);
    expect(clients[0].asked).toEqual([[[2667530], [], true]]);
    expect(clients[0].logOffs).toBe(1);
  });

  it('opens one session per read', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('25746735'),
    });

    await publisher.publishedVersion('sunkenland');
    await publisher.publishedVersion('sunkenland');

    expect(clients).toHaveLength(2);
  });

  it('reads nothing for a game that goes through no copy', async () => {
    const load = vi.fn();
    const publisher = steamPublisher({ appOf, load });

    expect(await publisher.publishedVersion('enshrouded')).toMatchObject({ readable: false });
    expect(load).not.toHaveBeenCalled();
  });

  it('answers an unreadable version when the product info is refused', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => {
        throw new Error('timed out');
      },
    });

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer).toMatchObject({ readable: false });
    expect(answer.readable === false && answer.cause).toContain('timed out');
    expect(clients[0].logOffs).toBe(1);
  });

  it('answers an unreadable version when Steam refuses the session', async () => {
    const { publisher } = publisherWith({
      onLogOn: (client) => setImmediate(() => client.emit('error', new Error('ServiceUnavailable'))),
    });

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer.readable === false && answer.cause).toContain('ServiceUnavailable');
  });

  it('answers an unreadable version when Steam does not answer within the delay', async () => {
    const { publisher, clients } = publisherWith({ onLogOn: () => undefined }, 20);

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer.readable === false && answer.cause).toContain('20 ms');
    expect(clients[0].logOffs).toBe(1);
  });

  // The listener stays until the client is gone: an error emitted after the
  // delay, with no listener, would throw out of the event loop and bring the
  // instance down.
  it('survives an error emitted after the delay, and keeps the answer it gave', async () => {
    const { publisher, clients } = publisherWith({ onLogOn: () => undefined }, 20);

    await publisher.publishedVersion('sunkenland');
    expect(() => clients[0].emit('error', new Error('LogonSessionReplaced'))).not.toThrow();
    clients[0].emit('loggedOn');
    expect(clients[0].asked).toEqual([]);
    expect(clients[0].logOffs).toBe(1);
  });

  it('answers an unreadable version for an application without a public branch', async () => {
    const { publisher } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => ({ apps: { [APP]: { appinfo: { depots: { branches: {} } } } } }),
    });

    expect(await publisher.publishedVersion('sunkenland')).toMatchObject({ readable: false });
  });

  it('answers an unreadable version for a build that is not one', async () => {
    const { publisher } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('latest'),
    });

    expect(await publisher.publishedVersion('sunkenland')).toMatchObject({ readable: false });
  });

  it('answers an unreadable version when the library cannot be loaded, and calls an injected loader again at the next read', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('ENOENT: steam-user resources'))
      .mockResolvedValueOnce(() => new FakeClient({ onLogOn: logsOn, productInfo: async () => publicBuild('25746735') }));
    const publisher = steamPublisher({ appOf, load, timeoutMs: 1000 });

    const first = await publisher.publishedVersion('sunkenland');
    expect(first.readable === false && first.cause).toContain('ENOENT');
    expect(await publisher.publishedVersion('sunkenland')).toEqual({ readable: true, version: '25746735' });
  });
});
