import type { JoinInfo } from '@beacon/session';
import type { BootRequest, GameCatalogEntry } from './catalog.js';

/**
 * What tranche 0 measured, moved from `docker-compose.yml` to here. It is a
 * template literal, so every `$` that must survive to the file is escaped:
 * unescaped, `${SERVER_PASSWORD}` would be read by TypeScript and the machine
 * would boot with the string `undefined` as a password.
 */
const COMPOSE = `services:
  enshrouded:
    image: mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d
    container_name: enshrouded
    restart: unless-stopped
    stop_grace_period: 90s
    ports:
      # Only the Steam query port is ever bound. The image still carries a
      # SERVER_PORT default, but nothing reads it, so no other port opens.
      - "15637:15637/udp"
    environment:
      SERVER_NAME: \${SERVER_NAME}
      SERVER_SLOT_COUNT: \${SERVER_SLOT_COUNT}
      # Never SERVER_PASSWORD. Upstream ignores it, and its fallback path fails
      # a jq call that truncates the config file — the game then regenerates it
      # with a random password nobody knows, on a server that looks healthy.
      SERVER_ROLE_0_NAME: Default
      SERVER_ROLE_0_PASSWORD: \${SERVER_PASSWORD}
      # The image's role template grants nothing but world editing, so these
      # three are what let players open chests and build.
      SERVER_ROLE_0_CAN_ACCESS_INVENTORIES: "true"
      SERVER_ROLE_0_CAN_EDIT_BASE: "true"
      SERVER_ROLE_0_CAN_EXTEND_BASE: "true"
      # Already the image default. Stated so that no update is a decision.
      UPDATE_CRON: ""
    volumes:
      - ./data:/opt/enshrouded
`;

const CLOUD_INIT = `#cloud-config
package_update: true
packages:
  - docker.io
  - docker-compose-v2

write_files:
  - path: /opt/beacon/docker-compose.yml
    permissions: "0644"
    content: |
      __DOCKER_COMPOSE__
  - path: /opt/beacon/.env
    permissions: "0600"
    content: |
      SERVER_NAME=__SERVER_NAME__
      SERVER_PASSWORD=__SERVER_PASSWORD__
      SERVER_SLOT_COUNT=__SLOT_COUNT__

runcmd:
  - [ systemctl, enable, --now, docker ]
  - [ mkdir, -p, /opt/beacon/data ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
`;

/** The marker sits six spaces in, so only the following lines get indented. */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : `      ${line}`))
    .join('\n');
}

/**
 * A function replacement, and every occurrence: `$&`, `` $` `` and `$'` inside
 * a password are capture-group syntax to String.replace, and would be
 * substituted silently. The server then boots with a password nobody has.
 */
function fill(template: string, marker: string, value: string): string {
  return template.replaceAll(marker, () => value);
}

export const enshrouded: GameCatalogEntry = {
  game: 'enshrouded',
  hostname: 'enshrouded.beacon.charlouze.com',

  compose: () => COMPOSE,

  render(request: BootRequest): string {
    let rendered = fill(CLOUD_INIT, '__DOCKER_COMPOSE__', indent(COMPOSE));
    rendered = fill(rendered, '__SERVER_NAME__', request.serverName);
    rendered = fill(rendered, '__SERVER_PASSWORD__', request.serverPassword);
    return fill(rendered, '__SLOT_COUNT__', String(request.slotCount));
  },

  joinInfo(address: string): JoinInfo {
    return {
      game: 'enshrouded',
      hostname: this.hostname as string,
      address,
      port: 15637,
    };
  },
};
