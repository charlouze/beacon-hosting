import { createSocket, type Socket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { a2sInfo, probeFor } from './a2s.js';

let server: Socket | null = null;

const listening = async (respond: (query: Buffer) => Buffer | null): Promise<number> => {
  server = createSocket('udp4');
  server.on('message', (message, from) => {
    const answer = respond(message);
    if (answer !== null) server?.send(answer, from.port, from.address);
  });
  await new Promise<void>((resolve) => server?.bind(0, '127.0.0.1', resolve));
  return (server?.address() as { port: number }).port;
};

afterEach(() => {
  server?.close();
  server = null;
});

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const info = () => Buffer.concat([HEADER, Buffer.from([0x49]), Buffer.from('beacon\0')]);
const challenge = () =>
  Buffer.concat([HEADER, Buffer.from([0x41]), Buffer.from([1, 2, 3, 4])]);

describe('a2sInfo', () => {
  it('is true when the server answers with its info', async () => {
    const port = await listening(() => info());
    expect(await a2sInfo('127.0.0.1', port, 500)).toBe(true);
  });

  // Valve's servers answer the first query with a challenge and the second with
  // the info. A probe that gave up on the challenge would call every healthy
  // server dead, and RUNNING would never be written.
  it('answers the challenge and reads the info that follows', async () => {
    let seen = 0;
    const port = await listening(() => (++seen === 1 ? challenge() : info()));
    expect(await a2sInfo('127.0.0.1', port, 500)).toBe(true);
    expect(seen).toBe(2);
  });

  // The ordinary case for the first five to eight minutes of every session:
  // the server is downloading and nothing is listening. It is not an error.
  it('is false when nothing answers before the timeout', async () => {
    const port = await listening(() => null);
    expect(await a2sInfo('127.0.0.1', port, 200)).toBe(false);
  });

  it('is false rather than throwing when the host does not resolve', async () => {
    expect(await a2sInfo('nothing.invalid', 15637, 200)).toBe(false);
  });

  it('reads the probe the catalogue wrote', () => {
    expect(probeFor('a2s://enshrouded:15637')).toEqual({
      host: 'enshrouded',
      port: 15637,
    });
  });

  // §4: the companion knows no game, so it does not guess. A probe it cannot
  // read is a catalogue entry that is wrong, and it says so at launch.
  it('refuses a probe it cannot read', () => {
    expect(() => probeFor('log://stdout')).toThrow(/log:\/\/stdout/);
  });

  // The socket is unconnected until it is bound to the one peer queried, and
  // this machine holds a public IP: without that binding, any datagram of the
  // right shape from anywhere on the internet would resolve the probe to
  // true, and that is the one write that turns a session RUNNING.
  it('ignores an answer that does not come from the host and port it queried', async () => {
    const spoofed: { socket: Socket | null } = { socket: null };
    const real = createSocket('udp4');
    real.on('message', (_message, from) => {
      // The real server the probe queried stays silent. Only a socket bound
      // to a different port answers, spoofing the reply's contents but not
      // its source.
      spoofed.socket = createSocket('udp4');
      spoofed.socket.send(info(), from.port, from.address);
    });
    await new Promise<void>((resolve) => real.bind(0, '127.0.0.1', resolve));
    const port = (real.address() as { port: number }).port;

    try {
      expect(await a2sInfo('127.0.0.1', port, 300)).toBe(false);
    } finally {
      real.close();
      spoofed.socket?.close();
    }
  });
});
