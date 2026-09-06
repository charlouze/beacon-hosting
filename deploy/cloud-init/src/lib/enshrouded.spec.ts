import { describe, expect, it } from 'vitest';
import { catalogFor, renderCloudInit, renderCompose } from './catalog.js';

const REQUEST = {
  serverName: 'Beacon',
  serverPassword: 'hunter2',
  slotCount: 4,
  sessionId: 's1',
  agentToken: 'a'.repeat(64),
  endpoint: 'https://europe-west1-beacon.cloudfunctions.net/agentReport',
  saves: {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    savesBucket: 'beacon-saves',
    gamesBucket: 'beacon-games',
    accessKey: 'SCWXXXXXXXXXXXXXXXXX',
    secretKey: 'a-secret-with-a$&-in-it',
  },
};

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
    expect(rendered).toContain('    content: |\n      services:\n        enshrouded:\n');
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

  it('yields the join point a player copies, from the address alone', () => {
    expect(catalogFor('enshrouded').joinInfo('51.15.42.7')).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.15.42.7',
      port: 15637,
    });
  });

  // Not an oversight, and the message has to say so: this game cannot boot
  // before its 2.3 GB are restored, which is the companion, which is tranche 3.
  it('refuses the game whose files nothing restores yet', () => {
    expect(() => catalogFor('sunkenland')).toThrow(/tranche 3/);
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
});
