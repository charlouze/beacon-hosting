import { describe, expect, it } from 'vitest';
import { catalogFor, renderCloudInit, renderCompose } from './catalog.js';

const REQUEST = { serverName: 'Beacon', serverPassword: 'hunter2', slotCount: 4 };

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
});
