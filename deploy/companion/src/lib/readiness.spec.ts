import { createSocket, type Socket } from 'node:dgram';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { probeFor } from './readiness.js';

let server: Socket | null = null;
let root: string;

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const info = () => Buffer.concat([HEADER, Buffer.from([0x49]), Buffer.from('beacon\0')]);

const listening = async (): Promise<number> => {
  server = createSocket('udp4');
  server.on('message', (_message, from) => server?.send(info(), from.port, from.address));
  await new Promise<void>((resolve) => server?.bind(0, '127.0.0.1', resolve));
  return (server?.address() as { port: number }).port;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beacon-readiness-'));
});

afterEach(() => {
  server?.close();
  server = null;
});

describe('probeFor', () => {
  // The form the tranche 3 already knew, unchanged: a probe still queries a
  // server the way a player does.
  it('still reads the form that queries a server the way a player does', async () => {
    const port = await listening();
    const probe = probeFor(`a2s://127.0.0.1:${port}`);
    expect(await probe()).toEqual({ ready: true });
  });

  // The second form: what a player copies is not an address, and there is no
  // port to query — the server writes an identifier to a file instead.
  it('reads the form that recovers an identifier from a file', async () => {
    const path = join(root, 'serverid');
    writeFileSync(path, '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242318300625638');
    const probe = probeFor(`serverid://${path}`);
    expect(await probe()).toEqual({
      ready: true,
      serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242318300625638',
    });
  });

  // The first five to eight minutes of every session, this file does not
  // exist yet. Not an incident: the ordinary case.
  it('is not ready while nothing has written the file', async () => {
    const probe = probeFor(`serverid://${join(root, 'nothing-here')}`);
    expect(await probe()).toEqual({ ready: false });
  });

  // A file with nothing in it is a file nobody has finished writing. The
  // shape is not judged here — this project knows no game.
  it('is not ready while the file holds nothing', async () => {
    const path = join(root, 'empty');
    for (const content of ['', '   ', '\n']) {
      writeFileSync(path, content);
      expect(await probeFor(`serverid://${path}`)()).toEqual({ ready: false });
    }
  });

  // The carriage return Wine writes is not part of the identifier. Not a
  // knowledge of the game — file-reading hygiene, and an identifier that kept
  // it would be refused by the catalogue for a cause nobody could read.
  it('reports the line without the whitespace around it', async () => {
    const path = join(root, 'crlf');
    writeFileSync(path, 'w~1\r\n');
    expect(await probeFor(`serverid://${path}`)()).toEqual({ ready: true, serverId: 'w~1' });
  });

  // Bounded like everything else that travels this wire (§5): a file
  // something else filled must not grow a report the Function accepts once a
  // minute.
  it('is not ready on a line longer than the protocol carries', async () => {
    const path = join(root, 'huge');
    writeFileSync(path, 'x'.repeat(1025));
    expect(await probeFor(`serverid://${path}`)()).toEqual({ ready: false });
  });

  // A form this companion cannot run is a catalogue entry to fix, said at
  // launch and naming what it received.
  it('refuses a form it cannot run, and names what it was given', () => {
    expect(() => probeFor('http://enshrouded:15637')).toThrow(/http:\/\/enshrouded:15637/);
  });
});
