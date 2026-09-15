import type { JoinInfo } from '@beacon/session';
import type { BootRequest, GameCatalogEntry, JoinFacts } from './catalog.js';
import { COMPANION_IMAGE } from './companion-image.js';
import { fill, indent } from './template.js';

/**
 * Measured 2026-09-05, and pinned by digest like every image this system runs
 * (§10). The image carries no game files at all: it downloads them, which is
 * exactly what §7 forbids on a machine that holds no Steam credential.
 */
const GAME_IMAGE =
  'melle2/sunkenland-ds@sha256:2b21e6f098c76f8da91a7c5f53e02ceb9af126fa93d05f7958fd189d759873b7';

/**
 * The game's name in the domain (§4): what the companion reports under, and
 * what the archive key below is built from. Kept apart from the container's
 * name on purpose — they read alike and change for opposite reasons.
 */
const GAME = 'sunkenland' as const;

/**
 * The one archive holding the 2.3 GB this machine may not download (§7), and
 * literally the same value `gameArchiveKeyFor` builds in `tools/game-depot`.
 * Module boundaries forbid importing it here, and nothing breaks when the two
 * diverge: only the smoke barrier holds both ends together.
 */
const GAME_FILES_KEY = `${GAME}/game.tar`;

/**
 * What the compose names the game container, and what the stop unit hands to
 * `docker stop`. One value for both: a unit naming a container the compose no
 * longer does would simply never stop anything, and nothing would say so.
 * Nothing else reads it — renaming a container has no business moving an
 * object key or the name a session is reported under.
 */
const GAME_CONTAINER = 'sunkenland';

/**
 * Measured, `probe/RESULTS.md`: character folders carry the exact same
 * `<name>~<guid>` shape as a world folder. This is the one discriminant
 * between them, so `worldLayoutRefusal` below requires it rather than trust
 * the shape alone.
 */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Measured: the region the server registers in, and the one a client filters by. */
const REGION = 'eu';

/** The commanditaire's decision (§2), and the binary logs it back verbatim. */
const AUTOSAVE_SECONDS = 300;

/**
 * The push follows what the game writes (§4): pushing more often than the
 * server saves would upload the same bytes twice, less often would lose the
 * last minutes of an evening. So it is derived from the cadence above rather
 * than written twice.
 */
const PUSH_INTERVAL_MS = AUTOSAVE_SECONDS * 1000;

/** Where the restore unpacks the 2.3 GB, and where the server reads them. */
const GAME_DIR = '/sunkenland/game';

/**
 * What `wine` launches, and literally the same value `SERVER_BINARY` guards in
 * `tools/game-depot` — the one file that tool refuses to deposit 2.3 GB
 * without. Module boundaries forbid importing it here, and the smoke barrier
 * closes nothing this time: its game container is a stub, so the line below
 * never runs there. A divergence therefore arrives in production mute — the
 * server never starts, the filter matches no identifier, no join point is ever
 * published, and the session dies of the provisioning delay. A test in each
 * project pins the literal, as for `GAME_FILES_KEY` above.
 */
const SERVER_BINARY = 'Sunkenland-DedicatedServer.exe';
/**
 * The image symlinks the game's own `LocalLow/…/Worlds` here, so this is a
 * mount point and not a folder. `BEACON_SAVE_DIR` names this same path: a
 * value that disagreed with the mount would push an empty folder all evening
 * without saying anything.
 */
const WORLD_DIR = '/sunkenland/Worlds';

/** The only thing the game container ever shows the outside (§7). */
const READY_DIR = '/opt/beacon/ready';
const READY_FILE = `${READY_DIR}/serverid`;

/** Measured: the image runs the server as this uid, and root unpacks for it. */
const SERVER_OWNER = '7000:7000';

/**
 * The one line that leaves the game container, and the whole reason this
 * filter exists. §7 forbids the docker socket, so the companion cannot read
 * this container's log — and it must not: the log carries the password three
 * times, once per joining player. So the entry point pipes its own output
 * through this, which copies it back byte for byte and extracts nothing but
 * the identifier.
 *
 * Exported as a value, and rendered by its own Nx target, so that a harness
 * can feed it a real trace without parsing a block scalar to find a file.
 *
 * Every `${` below is escaped, and so is every `\` a bash escape needs:
 * unescaped, TypeScript would read them, and the machine would boot on an
 * empty string rather than on a variable — no compilation error, just a value
 * that is gone.
 */
export const SERVERID_FILTER = `#!/usr/bin/env bash
# A copy, plus one extraction. Nothing here filters the log: what goes in comes
# out unchanged, because it is still the only trace a human has of a boot.
#
# No \`-e\`, deliberately: copying the log back is this script's job, and a
# single failed write — a full disk, a mount gone read-only — would kill the
# copy with it and take the boot's only trace along. \`-u\` and \`pipefail\` stay;
# they catch a mistake here without silencing the server.
set -uo pipefail

serverid=\${1:?the path to write the identifier to}

# The fragment both measured shapes carry, and deliberately not the sentence
# before it: \`probe/RESULTS.md\` recorded this announcement twice and the two
# disagree — section J has the sentence and the identifier on two separate
# lines, section V has them on one. Anchoring on the sentence bets on one of
# them being right; if the other is what comes out, this never matches, no file
# is written, the probe stays "not ready", and the session dies of the
# provisioning delay with nothing saying why — by design, this container's log
# crosses no boundary. This fragment appears in both, so nothing here depends
# on which of the two sections is right.
#
# Section J's third line carries \`ServerID:\`, never \`ServerID is '\`: it does
# not match, so it cannot overwrite a whole identifier with a truncated one.
marker="ServerID is '"

while IFS= read -r line || [[ -n "$line" ]]; do
  printf '%s\\n' "$line"
  case $line in
    *"$marker"*)
      id=\${line#*"$marker"}
      id=\${id%%\\'*}
      # Wine writes CRLF. The companion's readiness probe trims what it reads,
      # so nothing downstream needs this — it is here because this is the one
      # place that knows the value is an identifier, and a file left with a
      # stray carriage return is one every future reader has to remember to
      # trim.
      id=\${id%$'\\r'}
      # Written aside then renamed, never in place: a reader runs next to this
      # every thirty seconds, and a rename within one filesystem is atomic — so
      # what it reads is either absent or whole, never a line cut in half.
      printf '%s\\n' "$id" > "$serverid.tmp" && mv "$serverid.tmp" "$serverid"
      ;;
  esac
done
`;

/**
 * Nothing at all when nobody declared an identifier, and never an empty value:
 * `-adminSteamIDs` followed by nothing makes the parser swallow the option
 * after it, exactly as the empty `-password` did further down.
 *
 * The comma is a guess. The measurement of 2026-09-05 passed one identifier and
 * proved one thing — a save triggered from the game's console by that account —
 * and nothing about how this game reads a list.
 */
const adminOption = (adminSteamIds: readonly string[]): string =>
  adminSteamIds.length === 0
    ? ''
    : `
  # The argument form, never a file: it keeps a restored world pure data, and
  # Beacon writes nothing inside a save folder. What it buys is the only way a
  # human has of asking this game to save.
  -adminSteamIDs ${adminSteamIds.join(',')}`;

/**
 * The probe's script of 2026-09-05, adopted with its constraints and stripped
 * of what the probe carried only to try it: `-port`, `-publicip`, `-publicport`
 * and `-steamID` are all absent, because the measurement said a player behind
 * a real NAT joins from the list without any of them — and carrying them would
 * announce an address this game does not use.
 */
const startSh = (adminSteamIds: readonly string[]): string => `#!/usr/bin/env bash
set -euo pipefail

# Never SteamCMD: this dedicated server needs an account that owns the licence,
# and §7 keeps every Steam credential off a game machine. The 2.3 GB arrive
# from object storage, restored exactly like a save.
GAME_DIR=${GAME_DIR}
WORLD_DIR=${WORLD_DIR}
GAME_PASSWORD=\${GAME_PASSWORD:-}

# Everything this script and the server print goes through the filter, which
# copies it back unchanged: \`docker logs\` stays what it was. The one thing the
# filter does besides copying is write the identifier where the agent can read
# it — the agent has no docker socket (§7), and this log carries the password
# three times.
exec > >(/opt/beacon/serverid-filter.sh ${READY_FILE}) 2>&1

# The world comes off the disk and no longer from a compiled constant: the
# restore has just laid down exactly one \`<name>~<guid>\` folder, and that
# folder is the only thing that knows which world this evening opens.
#
# A glob into an array, and never a command substitution: this world is named
# \`Beacon's World\` — a space and an apostrophe — and anything that word-splits
# turns one folder into three paths that do not exist. A \`for\` over the quoted
# glob splits nothing either, and it is what lets each match be tested.
#
# Only directories: a stray \`notes~1.txt\` left beside the world matches the
# glob as well, and counting it refuses a boot the adoption had accepted.
shopt -s nullglob
worlds=()
for candidate in "$WORLD_DIR"/*~*; do
  if [[ -d $candidate ]]; then
    worlds+=("$candidate")
  fi
done
shopt -u nullglob

# A refusal, where there used to be a warning that booted anyway. Starting with
# no world is exactly how this game creates a blank one, has an evening played
# in it, and pushes it over the real save. Two folders are refused for the same
# reason: this entry point does not arbitrate, the adoption does.
if (( \${#worlds[@]} != 1 )); then
  printf 'beacon: expected exactly one <name>~<guid> folder under %s, found %s\\n' "$WORLD_DIR" "\${#worlds[@]}"
  exit 1
fi

world=\${worlds[0]##*/}
WORLD_GUID=\${world##*~}
# Character folders wear the same shape, and a folder whose tail is not a guid
# would launch the server on a world it cannot open — which it answers by
# creating one.
if [[ ! $WORLD_GUID =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  printf 'beacon: %s does not end in a guid\\n' "$world"
  exit 1
fi

printf 'beacon: opening %s\\n' "$world"

args=(
  -batchmode
  -nographics
  -worldGuid "$WORLD_GUID"
  -region ${REGION}
  -maxPlayerCapacity "\${MAX_PLAYERS:-4}"
  -autoSaveIntervalInSeconds ${AUTOSAVE_SECONDS}${adminOption(adminSteamIds)}
)

# Printed so a boot can be read back from the log without guessing what the
# container was told.
printf 'beacon: launching with %s\\n' "\${args[*]}"

# The password itself never goes on this line, but its length does: compose
# eats a \`$\` on the way in, and a password silently shortened is the one
# failure that looks exactly like a player typing it wrong. The renderer
# refuses a \`$\` before a machine exists; this is what makes the amputation
# visible if anything else ever shortens it.
printf 'beacon: password length %s\\n' "\${#GAME_PASSWORD}"

# Appended after the trace, and that is why it comes last: this log already
# leaks the password once per joining player, and the launch line does not add
# a second. Only when it holds something — upstream passes it unconditionally,
# and an empty value makes the parser swallow the next option: the password
# becomes literally "-region", with HasPassword true.
if [[ -n "$GAME_PASSWORD" ]]; then
  args+=(-password "$GAME_PASSWORD")
fi

# From here on, upstream's own launch sequence, kept verbatim except for the
# arguments. The image bakes DISPLAY=:1 and starts its X server through an init
# script rather than xvfb-run.
[ -f /tmp/.X1-lock ] && rm -f /tmp/.X1-lock

# And its teardown, for the same reason plus one of our own: as PID 1 a process
# with no handler never receives SIGTERM at all, so an \`exec\` here would turn
# every \`docker stop\` into a ten-second wait then a SIGKILL — possibly in the
# middle of an autosave, on the one folder this system cannot rebuild.
_terminate() {
  echo 'beacon: caught TERM, stopping'
  wineserver -k -w
  /etc/init.d/xvfb stop
}
trap _terminate HUP INT QUIT TERM

/etc/init.d/xvfb start

cd "$GAME_DIR"
wine "$GAME_DIR/${SERVER_BINARY}" "\${args[@]}" &
wait
`;

const COMPOSE = `services:
  # First, and the game waits on it. §6 étape 7: until this exits zero there is
  # no game container at all, so nobody can join a world that is not the right
  # one — and that evening cannot be saved over the real one. For this game it
  # also brings the 2.3 GB the machine is not allowed to download itself (§7),
  # which is one more \`get\` and no second code path.
  restore:
    image: ${COMPANION_IMAGE}
    container_name: beacon-restore
    command: ["/app/restore.mjs"]
    restart: "no"
    env_file:
      - /opt/beacon/companion.env
    volumes:
      - ./game:${GAME_DIR}
      - ./worlds:${WORLD_DIR}

  ${GAME_CONTAINER}:
    image: ${GAME_IMAGE}
    container_name: ${GAME_CONTAINER}
    # Ours replaces the image's, mounted rather than baked: upstream's tries a
    # \`+login anonymous\` on a licensed game, and mounting ours is what spares
    # this repository a fork and an image of its own.
    entrypoint: ["/opt/beacon/start.sh"]
    restart: unless-stopped
    stop_grace_period: 90s
    depends_on:
      restore:
        condition: service_completed_successfully
    ports:
      # Measured 2026-09-05: the server listens here without any -port having
      # been passed, and a player behind a real NAT joins from the list.
      - "27015:27015/udp"
    environment:
      # No world guid here: which world to open is read off the folder the
      # restore laid down, so the disk is the authority and nothing compiled
      # can disagree with it.
      #
      # Measured, and the costliest trap of this entry: compose interpolates
      # everything reaching a container's environment, \`env_file\` included, so
      # a password holding a \`$\` arrives truncated — \`a$bc\` as \`a\`, with a
      # warning about an unknown variable and none about the password. The
      # renderer refuses such a password before a billed machine exists.
      GAME_PASSWORD: \${SERVER_PASSWORD}
      MAX_PLAYERS: \${SERVER_SLOT_COUNT}
    volumes:
      - ./start.sh:/opt/beacon/start.sh:ro
      - ./serverid-filter.sh:/opt/beacon/serverid-filter.sh:ro
      # Read-only on purpose: these 2.3 GB are licensed files deposited once,
      # and nothing on a game machine has any business rewriting them.
      - ./game:${GAME_DIR}:ro
      # Where the identifier is announced, and the only thing this container
      # ever shows the rest of the machine.
      - ./ready:${READY_DIR}
      - ./worlds:${WORLD_DIR}

  agent:
    image: ${COMPANION_IMAGE}
    container_name: beacon-agent
    command: ["/app/agent.mjs"]
    restart: unless-stopped
    depends_on:
      ${GAME_CONTAINER}:
        condition: service_started
    env_file:
      - /opt/beacon/companion.env
    volumes:
      - ./worlds:${WORLD_DIR}
      # Read-only: the agent observes the identifier, it never writes one.
      - ./ready:${READY_DIR}:ro
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
  - path: /opt/beacon/start.sh
    permissions: "0755"
    content: |
      __START_SH__
  - path: /opt/beacon/serverid-filter.sh
    permissions: "0755"
    content: |
      __SERVERID_FILTER__
  - path: /opt/beacon/docker-compose.yml
    permissions: "0644"
    content: |
      __DOCKER_COMPOSE__
  # No server name: this game announces none. What a player looks for in the
  # list is the world's name, which the catalogue knows and the machine never
  # needs (§4).
  - path: /opt/beacon/.env
    permissions: "0600"
    content: |
      SERVER_PASSWORD=__SERVER_PASSWORD__
      SERVER_SLOT_COUNT=__SLOT_COUNT__
  # The machine's only credentials (§7): an s3 pair scoped to two buckets, and
  # a token that dies with the session. Nothing here can create a resource, and
  # no Steam credential rides along — that is the whole reason the game files
  # travel through a bucket.
  #
  # BEACON_SAVE_DIR is only correct because the compose above mounts the world
  # at that same path in both the restore and the agent. A value disagreeing
  # with those mounts pushes an empty folder all evening without a word.
  #
  # BEACON_GAME_FILES_KEY names one archive, fetched by one get and unpacked
  # by the same code that restores a world: this game cannot download its own
  # files, and §7 keeps the account that could off this machine entirely.
  - path: /opt/beacon/companion.env
    permissions: "0600"
    content: |
      BEACON_SESSION_ID=__SESSION_ID__
      BEACON_GAME=${GAME}
      BEACON_WORLD=__WORLD_ID__
      BEACON_TOKEN=__AGENT_TOKEN__
      BEACON_ENDPOINT=__ENDPOINT__
      BEACON_S3_ENDPOINT=__S3_ENDPOINT__
      BEACON_S3_REGION=__S3_REGION__
      BEACON_S3_ACCESS_KEY=__S3_ACCESS_KEY__
      BEACON_S3_SECRET_KEY=__S3_SECRET_KEY__
      BEACON_SAVES_BUCKET=__SAVES_BUCKET__
      BEACON_GAMES_BUCKET=__GAMES_BUCKET__
      BEACON_SAVE_DIR=${WORLD_DIR}
      BEACON_SAVE_OWNER=${SERVER_OWNER}
      BEACON_READY_PROBE=serverid://${READY_FILE}
      BEACON_STOP_FLAG=/opt/beacon/control/stop
      BEACON_PUSH_INTERVAL_MS=${PUSH_INTERVAL_MS}
      BEACON_GAME_FILES_KEY=${GAME_FILES_KEY}
      BEACON_GAME_DIR=${GAME_DIR}
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
      ExecStart=-/usr/bin/docker stop -t 90 ${GAME_CONTAINER}
      ExecStartPost=-/bin/rm -f /opt/beacon/control/stop

runcmd:
  - [ systemctl, enable, --now, docker ]
  - [ mkdir, -p, /opt/beacon/game, /opt/beacon/worlds, /opt/beacon/ready, /opt/beacon/control ]
  # Measured 2026-09-05, and the failure is mute: the server runs as an
  # unprivileged uid and cloud-init just made these folders as root, so without
  # an owner it announces nothing and saves nothing. The restore takes the
  # other two folders itself; this one it never touches, so it is taken here.
  - [ chown, '${SERVER_OWNER}', /opt/beacon/ready ]
  - [ systemctl, enable, --now, beacon-stop.path ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
`;

export const sunkenland: GameCatalogEntry = {
  game: GAME,

  /**
   * Nothing to point a record at: discovery goes through the game's own
   * lobby and transport through direct UDP that NAT traverses. Measured — a
   * player joined from the list with no address announced at all.
   */
  hostname: (): null => null,

  compose: () => COMPOSE,

  render(request: BootRequest): string {
    let rendered = fill(CLOUD_INIT, '__START_SH__', indent(startSh(request.adminSteamIds)));
    rendered = fill(rendered, '__SERVERID_FILTER__', indent(SERVERID_FILTER));
    rendered = fill(rendered, '__DOCKER_COMPOSE__', indent(COMPOSE));
    rendered = fill(rendered, '__WORLD_ID__', request.world.worldId);
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

  /**
   * The identifier is the only way into this game, and only the machine
   * discovers it — the world it names is now discovered there too, so there is
   * no constant left to compare against. What is compared instead is the report
   * against itself: the identifier must begin with the guid of the world the
   * same report announces.
   *
   * That catches a buggy companion, not a hostile machine — the hostile one is
   * stopped earlier and on the disk, where the companion refuses to report
   * `ready` for an identifier that does not name the world it restored. What
   * this adds is that the control plane never publishes a join point
   * inconsistent with itself.
   */
  joinInfo(facts: JoinFacts): JoinInfo | null {
    const { serverId, world } = facts;
    if (serverId === undefined || world === undefined || !serverId.startsWith(`${world.guid}~`)) {
      return null;
    }
    return { game: GAME, serverId, region: REGION, worldName: world.name };
  },

  worldLayoutRefusal(entries: readonly string[]): string | null {
    if (entries.length === 0) {
      return 'the archive is empty: no world folder at all';
    }
    const topLevel = new Set<string>();
    for (const entry of entries) {
      const slash = entry.indexOf('/');
      topLevel.add(slash === -1 ? entry : entry.slice(0, slash));
    }
    // <name>~<guid> is the shape, but character folders wear it too — the
    // guid check alone cannot tell a world from a parent-directory mistake
    // like "Worlds", which does not even carry a tilde.
    const named = [...topLevel].filter((folder) => {
      const tilde = folder.lastIndexOf('~');
      return tilde !== -1 && GUID_RE.test(folder.slice(tilde + 1));
    });
    if (named.length === 0) {
      return `found top-level entr${topLevel.size === 1 ? 'y' : 'ies'} ${[...topLevel].join(', ')}, none shaped like "<name>~<guid>": the archive may have been built from the parent directory`;
    }
    // §8: exactly one such folder, and not merely one of them holding a world.
    // The entry point on the machine counts folders, not worlds — a character
    // folder travelling alongside the world makes it exit 1 on every boot,
    // forever. Accepting it here would be an adoption that reports success and
    // denies every session after it, on the one gesture that has no undo.
    if (named.length > 1) {
      return `found ${named.length} "<name>~<guid>" folders (${named.join(', ')}): the machine boots on exactly one, so it would refuse this archive on every session`;
    }
    const worlds = named.filter((folder) =>
      entries.some(
        (entry) => entry.startsWith(`${folder}/`) && /^World~.*\.json$/.test(entry.slice(folder.length + 1)),
      ),
    );
    if (worlds.length === 0) {
      return `found ${named.join(', ')} but no World~*.json inside: cannot tell a world folder from a character folder`;
    }
    // Measured in production on 2026-09-14, and it cost two sessions. A world
    // played as a player-hosted game keeps its own StartGameConfig, and the
    // dedicated server reads it in place of its command line: capacity 0, and a
    // "Steam friends only" lock on a machine whose Steam id is the invalid one.
    // Its Photon registration then never completes, so the server appears in no
    // list — and nothing fails at the deposit, because the archive is otherwise
    // valid. Caught here or not at all.
    //
    // Measured on the other side too: the two archives that did boot carry
    // Cache.json and WorldSetting.json and nothing between them. So this names
    // the one file to remove, rather than ruling on everything a world may hold
    // — which would be completeness, and the §8 puts that out of reach.
    const hostedConfig = 'StartGameConfig.json';
    if (entries.includes(`${worlds[0]}/${hostedConfig}`)) {
      return `found ${hostedConfig} in ${worlds[0]}: that world was played as a player-hosted game, and the dedicated server reads those settings instead of its command line — delete ${hostedConfig} inside the world folder, then adopt again`;
    }
    return null;
  },
};
