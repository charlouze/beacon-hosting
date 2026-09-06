// Everything the companion asks of a game server, and nothing a game does. It
// answers A2S, it writes a world, and it dies on SIGTERM — which is what a
// `docker stop` sends, and what the one-verb channel triggers.
import { createSocket } from 'node:dgram';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SAVE_DIR ?? '/opt/enshrouded/savegame';
mkdirSync(dir, { recursive: true });

// Twenty kilobytes of random bytes, so the archive lands well above the floor
// of a save once gzipped. A constant fill compresses to a few hundred bytes —
// under the floor — and would make the round trip fail for the wrong reason.
writeFileSync(join(dir, '3ad85aea'), randomBytes(20_000));
writeFileSync(join(dir, '3ad85aea-index'), randomBytes(512));

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const socket = createSocket('udp4');
socket.on('message', (_message, from) => {
  socket.send(
    Buffer.concat([HEADER, Buffer.from([0x49]), Buffer.from('beacon-stub\0')]),
    from.port,
    from.address,
  );
});
socket.bind(Number(process.env.PORT ?? 15637));

process.on('SIGTERM', () => {
  socket.close();
  process.exit(0);
});
