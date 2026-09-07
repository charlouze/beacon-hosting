import type { JoinInfo } from '@beacon/session';
import type { BootRequest, GameCatalogEntry } from './catalog.js';

// §10: pinned by digest, never a moving tag — the one component that writes
// to the bucket, so a tag that moved under a session nobody watched would be
// the one image nobody tested. Re-resolve by hand from a published git tag,
// never by re-pulling a floating one.
const COMPANION = 'ghcr.io/charlouze/beacon-companion@sha256:7717f76dcc07185554d7ce26ef13ff042121185460f4722724b56b781005b9ef';

/**
 * What tranche 0 measured, moved from `docker-compose.yml` to here. It is a
 * template literal, so every `$` that must survive to the file is escaped:
 * unescaped, `${SERVER_PASSWORD}` would be read by TypeScript and the machine
 * would boot with the string `undefined` as a password.
 */
const COMPOSE = `services:
  # First, and the game waits on it. §6 étape 7: until this exits zero there is
  # no game container at all, so nobody can join a world that is not the right
  # one — and that evening cannot be saved over the real one.
  restore:
    image: ${COMPANION}
    container_name: beacon-restore
    command: ["/app/restore.mjs"]
    restart: "no"
    env_file:
      - /opt/beacon/companion.env
    volumes:
      - ./data:/opt/enshrouded

  enshrouded:
    image: mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d
    container_name: enshrouded
    restart: unless-stopped
    stop_grace_period: 90s
    depends_on:
      restore:
        condition: service_completed_successfully
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

  agent:
    image: ${COMPANION}
    container_name: beacon-agent
    command: ["/app/agent.mjs"]
    restart: unless-stopped
    depends_on:
      enshrouded:
        condition: service_started
    env_file:
      - /opt/beacon/companion.env
    volumes:
      - ./data:/opt/enshrouded
      # The one channel to the host, and it carries one verb. A docker socket
      # here would have been root on the machine (§7).
      - ./control:/opt/beacon/control
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
  # The machine's only credentials (§7): an s3 pair scoped to two buckets, and
  # a token that dies with the session. Nothing here can create a resource.
  #
  # BEACON_SAVE_DIR is only correct if the compose that writes this box's
  # companion mount resolves it to /opt/enshrouded/server/savegame on the
  # host — where probe/RESULTS.md (2026-09-03) measured the world actually
  # living. The ./data:/opt/enshrouded mount above is what makes it resolve
  # there: the game installs under server/, inside the same folder the
  # companion mounts. enshrouded.spec.ts pins the literal value below; only a
  # real boot proves the mount actually agrees with it.
  - path: /opt/beacon/companion.env
    permissions: "0600"
    content: |
      BEACON_SESSION_ID=__SESSION_ID__
      BEACON_GAME=enshrouded
      BEACON_TOKEN=__AGENT_TOKEN__
      BEACON_ENDPOINT=__ENDPOINT__
      BEACON_S3_ENDPOINT=__S3_ENDPOINT__
      BEACON_S3_REGION=__S3_REGION__
      BEACON_S3_ACCESS_KEY=__S3_ACCESS_KEY__
      BEACON_S3_SECRET_KEY=__S3_SECRET_KEY__
      BEACON_SAVES_BUCKET=__SAVES_BUCKET__
      BEACON_GAMES_BUCKET=__GAMES_BUCKET__
      BEACON_SAVE_DIR=/opt/enshrouded/server/savegame
      BEACON_SAVE_OWNER=4711:4711
      BEACON_READY_PROBE=a2s://enshrouded:15637
      BEACON_STOP_FLAG=/opt/beacon/control/stop
      BEACON_PUSH_INTERVAL_MS=600000
  # What the companion can ask of the host, and the whole of it. A path unit
  # watches one file; the service it starts runs one command. §7: a compromised
  # companion obtains a stopped container, not the docker api.
  - path: /etc/systemd/system/beacon-stop.path
    permissions: "0644"
    content: |
      [Unit]
      Description=Watch for the companion's stop request
      [Path]
      PathExists=/opt/beacon/control/stop
      [Install]
      WantedBy=multi-user.target
  - path: /etc/systemd/system/beacon-stop.service
    permissions: "0644"
    content: |
      [Unit]
      Description=Stop the game server
      After=docker.service
      [Service]
      Type=oneshot
      # PathExists= re-fires on every deactivation of this unit while the flag
      # it watches still exists — without ExecStartPost= clearing it, the
      # unit retriggers, exhausts systemd's default start rate limit, and
      # beacon-stop.path ends failed. That alone is not enough: an unprefixed
      # ExecStart= that fails skips every ExecStartPost= below it
      # (systemd.service(5)), and docker stop against a container already
      # gone exits non-zero — the ordinary shape of a retry, not a rare one.
      # The leading dash makes ExecStart='s own exit code never block the
      # clear, so the flag is gone whether the stop succeeded or not.
      ExecStart=-/usr/bin/docker stop -t 90 enshrouded
      ExecStartPost=-/bin/rm -f /opt/beacon/control/stop

runcmd:
  - [ systemctl, enable, --now, docker ]
  - [ mkdir, -p, /opt/beacon/data ]
  - [ mkdir, -p, /opt/beacon/control ]
  - [ systemctl, enable, --now, beacon-stop.path ]
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
    rendered = fill(rendered, '__SLOT_COUNT__', String(request.slotCount));
    rendered = fill(rendered, '__SESSION_ID__', request.sessionId);
    rendered = fill(rendered, '__AGENT_TOKEN__', request.agentToken);
    rendered = fill(rendered, '__ENDPOINT__', request.endpoint);
    rendered = fill(rendered, '__S3_ENDPOINT__', request.saves.endpoint);
    rendered = fill(rendered, '__S3_REGION__', request.saves.region);
    rendered = fill(rendered, '__S3_ACCESS_KEY__', request.saves.accessKey);
    rendered = fill(rendered, '__S3_SECRET_KEY__', request.saves.secretKey);
    rendered = fill(rendered, '__SAVES_BUCKET__', request.saves.savesBucket);
    return fill(rendered, '__GAMES_BUCKET__', request.saves.gamesBucket);
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
