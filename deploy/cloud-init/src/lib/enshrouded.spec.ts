import { describe, expect, it } from 'vitest';
import { catalogFor, renderCloudInit, renderCompose } from './catalog.js';
import { REQUEST, serviceBlock } from './catalogue-fixtures.spec-helper.js';

describe('the enshrouded catalogue entry', () => {
  // §10: an immutable digest, never a moving tag. With a moving one, tonight's
  // session could pull an image nobody tested and nothing would say which ran.
  it('pins the image by digest and never by tag', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toContain('mornedhels/enshrouded-server@sha256:');
    expect(compose).not.toContain(':latest');
  });

  // Measured in tranche 0: upstream ignores SERVER_PASSWORD *and* its fallback
  // truncates the config file — the game then regenerates it with a random
  // password nobody knows, on a server that looks healthy.
  it('passes the password through the role variable, never the deprecated one', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toContain('SERVER_ROLE_0_PASSWORD: ${SERVER_PASSWORD}');
    expect(compose).not.toMatch(/^\s+SERVER_PASSWORD:/m);
  });

  // The image's role template grants world editing and nothing else. Without
  // these three, players can neither build nor open a chest.
  it('grants the three role rights the image does not', () => {
    const compose = renderCompose('enshrouded');
    for (const right of [
      'SERVER_ROLE_0_CAN_ACCESS_INVENTORIES',
      'SERVER_ROLE_0_CAN_EDIT_BASE',
      'SERVER_ROLE_0_CAN_EXTEND_BASE',
    ]) {
      expect(compose).toContain(`${right}: "true"`);
    }
  });

  // One udp port, measured. 15636 is never bound by the image, and opening it
  // would advertise a door that answers nothing.
  it('publishes one udp port and only one', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toContain('"15637:15637/udp"');
    expect(compose).not.toContain('15636');
  });

  it('writes the session password into a file only root can read', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('SERVER_PASSWORD=hunter2');
    expect(rendered).toMatch(/path: \/opt\/beacon\/\.env\n {4}permissions: "0600"/);
  });

  // A `$&` or a `$'` in a password is capture-group syntax to String.replace.
  // It corrupted a password once, silently, on a server that then looked fine.
  it('carries a password full of replacement syntax through untouched', () => {
    const rendered = renderCloudInit('enshrouded', {
      ...REQUEST,
      serverPassword: "a$&b$'c$`d",
    });
    expect(rendered).toContain("SERVER_PASSWORD=a$&b$'c$`d");
  });

  // The compose travels as a block scalar, so its depth is its syntax: a line
  // landing short of the six spaces closes the block, and everything after it
  // becomes cloud-init keys nobody wrote. Nothing else catches that — the
  // `cloud-init schema` recipe of `deploy/README.md` is run by hand, if at all,
  // and by then the broken document is already on a billed machine.
  it('lays the compose inside the block scalar, every line at its own depth', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('    content: |\n      services:\n');
    expect(rendered).toContain('\n        restore:\n');
    expect(rendered).toContain('\n        enshrouded:\n');
    expect(rendered).toContain('\n          image: mornedhels/enshrouded-server@sha256:');
    expect(rendered).toContain('\n            - "15637:15637/udp"');
    expect(rendered).toContain('\n            - ./data:/opt/enshrouded\n');
  });

  // A marker left behind is a hole in the document that still looks like a
  // document: cloud-init runs, and the machine boots on a literal
  // `__SERVER_PASSWORD__`.
  it('leaves no marker of its own behind', () => {
    expect(renderCloudInit('enshrouded', REQUEST)).not.toContain('__');
  });

  it('starts the compose it just wrote, and nothing else', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('[ docker, compose, -f, /opt/beacon/docker-compose.yml,');
    expect(rendered.startsWith('#cloud-config\n')).toBe(true);
  });

  // This game publishes an address, and nothing the machine declares enters
  // what a player copies: the address comes from what the function reserved.
  it('yields the join point a player copies, from the reserved address', () => {
    expect(catalogFor('enshrouded').joinInfo({ address: '51.15.42.7' })).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.15.42.7',
      port: 15637,
    });
  });

  // And an identifier that arrived anyway changes nothing: this game has no use
  // for one, and a catalogue entry reading a field it does not use would be a
  // frontier that leaks.
  it('ignores an identifier this game has no use for', () => {
    expect(
      catalogFor('enshrouded').joinInfo({ address: '51.15.42.7', serverId: 'whatever' }),
    ).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.15.42.7',
      port: 15637,
    });
  });

  it('hands the machine its session, its token and where to report', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('BEACON_SESSION_ID=s1');
    expect(rendered).toContain(`BEACON_TOKEN=${'a'.repeat(64)}`);
    expect(rendered).toContain(
      'BEACON_ENDPOINT=https://europe-west1-beacon.cloudfunctions.net/agentReport',
    );
  });

  // Every value that reaches the machine goes through the same replacement, and
  // a `$&` in an s3 secret is capture-group syntax to String.replace exactly as
  // it is in a password. A silently corrupted key restores nothing, on a
  // machine that looks healthy.
  it('carries an s3 secret full of replacement syntax through untouched', () => {
    expect(renderCloudInit('enshrouded', REQUEST)).toContain(
      'BEACON_S3_SECRET_KEY=a-secret-with-a$&-in-it',
    );
  });

  // §7: the two buckets, and only these two. A machine that could write the
  // game files would be a machine that can destroy licensed data it did not
  // deposit.
  it('names the bucket it writes and the bucket it reads', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('BEACON_SAVES_BUCKET=beacon-saves');
    expect(rendered).toContain('BEACON_GAMES_BUCKET=beacon-games');
  });

  // §7: the credentials the machine holds are the s3 pair and the token. A
  // Scaleway Instance key here would let a compromised vm create machines.
  it('carries no provider api credential at all', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).not.toContain('SCW_SECRET_KEY');
    expect(rendered).not.toContain('X-Auth-Token');
  });

  // The companion's env file holds a token and an s3 pair; the game's holds a
  // server password. Neither is readable by anything but root.
  it('writes both credential files where only root can read them', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toMatch(/path: \/opt\/beacon\/\.env\n {4}permissions: "0600"/);
    expect(rendered).toMatch(/path: \/opt\/beacon\/companion\.env\n {4}permissions: "0600"/);
  });

  // §10, on our image exactly as on the one we borrow: with a moving tag,
  // tonight's session could pull a companion nobody tested, on the one
  // component that writes to the bucket.
  it('pins the companion by digest and never by tag', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toContain('ghcr.io/charlouze/beacon-companion@sha256:');
    expect(compose).not.toMatch(/beacon-companion:[^@]/);
  });

  // §6, étape 7, and the reason the golden rule holds: the ordering is in the
  // tool, not in a convention. Until `restore` exits zero there is no game
  // container at all, so nobody can join a world that is not the right one and
  // have that evening saved over the real one.
  it('makes the game wait for a restore that succeeded', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toMatch(
      /enshrouded:[\s\S]*depends_on:[\s\S]*restore:[\s\S]*condition: service_completed_successfully/,
    );
  });

  it('runs the two services from one image, on two commands', () => {
    const compose = renderCompose('enshrouded');
    expect(compose).toContain('command: ["/app/restore.mjs"]');
    expect(compose).toContain('command: ["/app/agent.mjs"]');
  });

  // The one-verb channel (§6, arrêt propre). The companion touches a file; a
  // unit on the host runs `docker stop` and nothing else. A socket mounted in
  // the companion would have been root on the machine. `-t 90` matches the
  // compose's own stop_grace_period, so the unit gives the world the same
  // grace to flush that the compose already promises it.
  // §7: the agent token is the only credential that rides to the machine, and
  // the companion sends it back in an `authorization` header once a minute for
  // the whole session. An http endpoint would put it on the wire in clear, and
  // nothing downstream would notice — the reports would succeed, the session
  // would run, and the leak would leave no trace.
  //
  // Refused here rather than on the machine because this is the only place the
  // value enters the system: it comes from `AGENT_ENDPOINT`, filled by a human,
  // and a tunnel url pasted in a hurry is exactly the shape this catches. The
  // companion stays permissive so the smoke harness can keep answering on http
  // over a docker bridge, where no wire leaves the developer's machine.
  it('refuses to write a cloud-init that would carry the token in clear', () => {
    expect(() =>
      renderCloudInit('enshrouded', { ...REQUEST, endpoint: 'http://control.example/agentReport' }),
    ).toThrow(/endpoint/i);
  });

  it('gives the host a unit that can only stop the game', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('ExecStart=-/usr/bin/docker stop -t 90 enshrouded');
    expect(rendered).toContain('PathExists=/opt/beacon/control/stop');
  });

  // PathExists= re-fires every time the unit it triggers deactivates, for as
  // long as the flag it watches still exists. Without ExecStartPost=
  // clearing it, the unit retriggers on its own success, exhausts systemd's
  // default start rate limit, and beacon-stop.path ends failed after every
  // session. That alone is not the whole fix: an unprefixed ExecStart= that
  // fails skips every ExecStartPost= below it (systemd.service(5)), and
  // `docker stop` against a container already gone — the ordinary shape of
  // a retry — exits non-zero. ExecStart='s own leading `-` is what makes the
  // clear happen either way; pinned here alongside the clear itself, since a
  // fix to one without the other is silent until the failure path runs.
  it('clears its own stop flag so the path unit does not retrigger, on failure too', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('ExecStart=-/usr/bin/docker stop -t 90 enshrouded');
    expect(rendered).toContain('ExecStartPost=-/bin/rm -f /opt/beacon/control/stop');
  });

  // §7: what a compromised companion can obtain is what its s3 key allows, and
  // nothing more. The socket is the one mount that would change that answer.
  it('mounts no docker socket anywhere', () => {
    expect(renderCloudInit('enshrouded', REQUEST)).not.toContain('docker.sock');
  });

  // A block, not the whole compose: `[\s\S]*` crosses service boundaries, so
  // matching against the full text would still pass with restore's own mount
  // deleted, as long as some *other* service still mentions ./data — the same
  // "nothing says the world was never saved" failure the BEACON_SAVE_DIR fix
  // above exists to catch. Scoped to each service's own block instead.
  it('gives both companion services the world, and the agent the control folder', () => {
    const compose = renderCompose('enshrouded');
    expect(serviceBlock(compose, 'restore')).toContain('./data:/opt/enshrouded');
    expect(serviceBlock(compose, 'agent')).toContain('./control:/opt/beacon/control');
  });

  // The comment above BEACON_SAVE_DIR in the write_files block: the value is
  // only correct if the mount the compose gives the companion resolves it
  // where probe/RESULTS.md (2026-09-03) measured the world actually living.
  // `./data:/opt/enshrouded` puts the game's own install — and its
  // savegame/ — under /opt/enshrouded/server, so the value must carry that
  // segment or every push silently saves nothing.
  it('points the save dir where the compose actually mounts the world', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('BEACON_SAVE_DIR=/opt/enshrouded/server/savegame');
  });
});
