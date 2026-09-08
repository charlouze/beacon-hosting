import { createSocket } from 'node:dgram';

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const A2S_INFO = Buffer.concat([
  HEADER,
  Buffer.from([0x54]),
  Buffer.from('Source Engine Query\0', 'ascii'),
]);
const CHALLENGE = 0x41;
const INFO = 0x49;

/**
 * Whether the game server answers a player's own question. §6 chose this over
 * the presence of a process or an open port on purpose: those are proxies, and
 * "can somebody connect" is the thing itself.
 *
 * False for every failure — a timeout, a name that does not resolve, a socket
 * that refuses. For the first five to eight minutes of a session the server is
 * downloading and nothing is listening; that is the ordinary case, not an
 * incident, and a throw would make the loop treat it as one.
 */
export async function a2sInfo(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = createSocket('udp4');
    let settled = false;

    const finish = (answer: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(answer);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    socket.on('error', () => finish(false));

    socket.on('message', (message) => {
      if (message.length < 5 || !message.subarray(0, 4).equals(HEADER)) return;
      if (message[4] === INFO) {
        finish(true);
        return;
      }
      // Valve answers the first query with a four-byte challenge and the info
      // only to a query that echoes it back. A probe that stopped here would
      // report every healthy server as dead.
      if (message[4] === CHALLENGE && message.length >= 9) {
        socket.send(Buffer.concat([A2S_INFO, message.subarray(5, 9)]), (error) => {
          if (error) finish(false);
        });
      }
    });

    // `connect` binds this socket to exactly one peer: the kernel delivers
    // only datagrams whose source is `host:port` and drops every other one
    // before it ever reaches the `message` handler above. Without this, an
    // unconnected socket on a machine with a public IP would accept a forged
    // info reply from anywhere on the internet — and that report, not the
    // Function, is what writes RUNNING.
    //
    // A name that does not resolve surfaces on `error`, never on `connect` —
    // taking the callback form here would call `send` on a socket that never
    // connected, on a host this companion does not control.
    socket.on('connect', () => {
      socket.send(A2S_INFO, (error) => {
        if (error) finish(false);
      });
    });
    socket.connect(port, host);
  });
}
