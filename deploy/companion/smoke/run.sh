#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# The one argument this script takes: which game's compose service and env
# file to exercise. `enshrouded` stays the default so the bare invocation
# every prior task documented still works unchanged.
GAME="${1:-enshrouded}"
ENV_FILE="./${GAME}.env"

# The env file is the one place BEACON_SAVE_DIR is written; sourcing it here
# means this script reads that path instead of duplicating it in every
# `docker compose exec` below, once per game instead of once per call site.
. "$ENV_FILE"

# The digest this cleanup runs as root through — already pulled by the time
# this matters (../Dockerfile's own FROM, and the stub's image), pinned so
# this reaches for no image the rest of this stack does not already trust.
CLEANUP_IMAGE="node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32"

# The world lands in ./tmp/data as root: the Dockerfile is USER root,
# node:22-alpine defaults to root, and BEACON_SAVE_OWNER=0:0 ($ENV_FILE).
# Docker Desktop's shared-filesystem shim hides that on a workstation; a
# Linux runner will not, and the account running this script cannot delete
# what a root-owned daemon wrote — only a root container can. `rm -rf ./tmp`
# from the host would fail there, and under `set -e` a failing command in the
# EXIT trap becomes this script's own exit status: a fully green barrier
# would still report red.
clean_tmp() {
  [ -d ./tmp ] || return 0
  # MSYS_NO_PATHCONV=1, or Git Bash on Windows rewrites the bind spec's host
  # side into something like `...smoke;W:\` before Docker ever sees it — the
  # same rewriting this file already routes every absolute container path
  # around elsewhere. A no-op on a platform without MSYS to do the rewriting.
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/w" "$CLEANUP_IMAGE" rm -rf /w/tmp
}

# Relative, and matching `fake-endpoint.mjs`'s own path: an absolute `/tmp`
# is not the same place for a native Windows node and an MSYS bash on the
# machine of whoever runs this outside CI.
PHASES_LOG=./tmp/beacon-smoke-phases.log
clean_tmp
mkdir -p ./tmp
rm -f /tmp/roundtrip.tar.gz

# Every `docker compose` call below reads these instead of a hand-maintained
# `docker-compose.yml` (task 11): the compose this harness launches is the
# catalogue's own, with only the game service replaced by the stub. A service
# added to the catalogue reaches this stack without a line changed here.
export COMPOSE_FILE=./tmp/docker-compose.smoke.yml
export COMPOSE_PROJECT_NAME=beacon-companion-smoke
# The declared target, not a hand-rederived `WHAT=compose npx tsx ...`: this
# is the one place that knowledge should live. `nx run` wraps even a single
# target's own stdout in a banner and a footer on this Nx version, which is
# what render-smoke-compose.mjs's own `extractComposeYaml` exists to strip —
# by looking for the first ANSI escape byte after `services:`. That signal
# is only there because Nx colours its banner through picocolors, and
# `isColorSupported` is not always true (it depends on TTY/CI detection);
# FORCE_COLOR=1 makes the signal unconditional instead of environment-guessed,
# the same shape of bug this round's headline finding already was once.
# GAME picks the catalogue's own service; render-smoke-compose.mjs needs the
# same name to find and replace it, plus SAVE_DIR to fill the stub's mount —
# both travel as environment rather than a second command-line argument
# because render-smoke-compose.mjs already reads its compose from stdin.
#
# MSYS_NO_PATHCONV=1: without it, Git Bash on Windows rewrites SAVE_DIR's
# POSIX-looking value into a host path before node (a native, non-MSYS
# executable) ever sees it — the same rewriting clean_tmp already routes
# around, met here for the first time because this is the first container
# path carried through a shell environment variable instead of typed literally.
GAME="$GAME" FORCE_COLOR=1 npx nx run cloud-init:render-compose |
  MSYS_NO_PATHCONV=1 GAME="$GAME" SAVE_DIR="$BEACON_SAVE_DIR" node ./render-smoke-compose.mjs > "$COMPOSE_FILE"

# A hard kill of a previous run (Ctrl-C, a crashed runner) can leave this
# stack's containers behind. A stale control flag in particular would carry
# yesterday's `stop` file into a fresh container, and the clean-shutdown
# block below would find its flag already there at t=0 — passing on
# leftover state instead of on anything this run did. There are no named
# volumes to strand any more (task 11): both mounts are host directories
# under ./tmp, cleared by clean_tmp at the end of this script.
docker compose down -v --remove-orphans 2>/dev/null || true

# The endpoint the companion reports to. A one-file server, because what is
# under test is the companion and not the Function — which has its own suite
# against the emulator.
node ./fake-endpoint.mjs & endpoint=$!
trap 'kill $endpoint 2>/dev/null || true; docker compose down -v; clean_tmp; rm -f /tmp/roundtrip.tar.gz' EXIT

# A failed report is deliberately non-fatal in the companion (agent-loop.ts,
# push.ts): the stack can run to a green finish with no control plane at all
# unless something here refuses to proceed without one.
for _ in $(seq 1 50); do
  if ! kill -0 "$endpoint" 2>/dev/null; then
    echo "smoke: the fake endpoint exited before it started listening (port 8787 busy?)" >&2
    exit 1
  fi
  if (exec 3<>/dev/tcp/127.0.0.1/8787) 2>/dev/null; then
    exec 3>&-
    break
  fi
  sleep 0.2
done
if ! (exec 3<>/dev/tcp/127.0.0.1/8787) 2>/dev/null; then
  echo "smoke: the fake endpoint never started listening on 8787" >&2
  exit 1
fi
exec 3>&-

docker build -t beacon-companion:smoke -f ../Dockerfile ..
docker compose up -d bucket
docker compose exec -T bucket mc alias set local http://localhost:9000 smoke smokesmoke
docker compose exec -T bucket mc mb local/beacon-saves

# 1 — a first boot with an empty bucket restores nothing, and succeeds. This is
# the legitimate case the whole first defense turns on: a *listed* absence.
docker compose up --exit-code-from restore restore
docker compose up -d "$GAME" agent

# 2 — the round trip. The stub wrote a world, the agent archives and deposits
# it. `restore.mjs`, run a second time against the now-populated bucket, must
# recover the exact same two files — an archive of any garbage over 1024
# bytes would have passed a check that only looked at the deposit's size.
#
# `mc find --name`, not `mc ls`: the key nests under game/origin/session, so a
# non-recursive listing of the game prefix never reaches the archive itself.
timeout 180 bash -c 'until docker compose exec -T bucket mc find local/beacon-saves --name "*.tar.gz" 2>/dev/null | grep -q tar.gz; do sleep 2; done'
key=$(docker compose exec -T bucket mc find local/beacon-saves --name '*.tar.gz' | head -1 | tr -d '\r')
docker compose exec -T bucket mc cat "$key" > /tmp/roundtrip.tar.gz
test "$(stat -c%s /tmp/roundtrip.tar.gz)" -gt 1024

# The stub exists to answer A2S; `ready` is only ever reported once that
# answer came back, so its presence is the proof the probe actually ran.
grep -q '^ready$' "$PHASES_LOG"

original=$(docker compose exec -T "$GAME" sh -c "sha256sum $BEACON_SAVE_DIR/3ad85aea $BEACON_SAVE_DIR/3ad85aea-index" | tr -d '\r')
docker compose stop agent
docker compose run --rm -T --entrypoint sh --no-deps restore -c "rm -f $BEACON_SAVE_DIR/*"
docker compose up --force-recreate --exit-code-from restore restore
recovered=$(docker compose run --rm -T --entrypoint sh --no-deps restore -c "sha256sum $BEACON_SAVE_DIR/3ad85aea $BEACON_SAVE_DIR/3ad85aea-index" | tr -d '\r')
test "$original" = "$recovered"
docker compose up -d agent

# 3 — the one the spec names. An empty world produces an archive under the
# floor, and nothing is deposited. The refusal is read directly out of the
# agent's own log, and the container's still running when the wait is over —
# an agent that had simply died would also leave the object count unchanged.
before=$(docker compose exec -T bucket mc ls -r local/beacon-saves | wc -l)
test "$before" -ge 1
docker compose exec -T agent sh -c "rm -f $BEACON_SAVE_DIR/*"
sleep 90
after=$(docker compose exec -T bucket mc ls -r local/beacon-saves | wc -l)
test "$before" -eq "$after"
docker compose logs agent | grep -q 'under the floor of a save'
test "$(docker inspect -f '{{.State.Running}}' "$(docker compose ps -q agent)")" = "true"

echo "smoke: the round trip holds and the empty archive was refused"

# 4 — clean shutdown (§6, task 9 ter). Told STOPPING, the companion must stop
# the game through its one-verb channel, archive a `pre-shutdown` save, and
# report `saved` — in that order. This stack has no Function and destroys no
# resource, so it cannot reproduce the control-plane defect the whole-branch
# review found (the Function destroying the machine too early); it closes the
# other half, against a real container, which nothing else exercises today.
# Last, because it ends the agent process for good, the moment it sees STOPPING.
#
# The refusal test above emptied the world; repopulate it here, or the final
# push below is refused too and the wait for an object below never ends, for
# the wrong reason.
docker compose exec -T agent sh -c "
  head -c 20000 /dev/urandom > $BEACON_SAVE_DIR/3ad85aea
  head -c 512 /dev/urandom > $BEACON_SAVE_DIR/3ad85aea-index
"

STOPPING_FLAG=./tmp/beacon-smoke-stopping
touch "$STOPPING_FLAG"

# The companion only ever touches a file (push.ts, stopAndPush) — on the real
# host a systemd unit watches it and runs `docker stop`, and the companion
# never gets a docker socket (§7). Nothing in this stack plays that unit's
# part, so this script does, exactly as the unit would: watch the file, then
# `docker stop`. If the companion never touches it, this times out before the
# game is ever asked to stop — the honest way for this to fail.
#
# `sh -c '...'`, not a bare `test -f` argument: passed directly, Git Bash on
# Windows rewrites a leading `/opt/...` into a host path before Docker ever
# sees it, and the check fails for a path that was never the one being asked
# about — the same reason every other absolute path above already goes
# through a shell string instead of a bare argument.
timeout 120 bash -c "until docker compose exec -T agent sh -c 'test -f /opt/beacon/control/stop' 2>/dev/null; do sleep 1; done" ||
  { echo "smoke: the companion never touched its one-verb stop flag" >&2; exit 1; }

# The order §6 requires — stop before archive — is what this line pins, not
# the wait above it: that wait only proves the flag was *observed* before the
# object was *observed*, which a `stopAndPush` that pushed first and touched
# the flag afterwards would also satisfy (the flag would still be there by
# the time this script got around to checking, and the object would already
# exist too). This script has not called `docker compose stop "$GAME"` yet, so
# the game is still running — a correctly-ordered companion is still polling
# for quiet and cannot legitimately have deposited anything yet.
#
# Output and exit status are checked separately, and neither is discarded: a
# transient failure of `docker compose exec` or `mc find` prints empty stdout
# and would otherwise pass exactly as if the prefix were legitimately empty —
# the same "passes when the command errored" class this whole barrier exists
# to eliminate, on the one assertion singled out for adversarial reading.
#
# The search root is the bucket, not the `pre-shutdown` prefix itself: that
# prefix names no object yet at this point in the script, and `mc find`
# treats a target path that does not exist as an error, not an empty match —
# querying it directly would make the legitimate case indistinguishable from
# the failure this guard exists to catch. `local/beacon-saves` was created a
# few lines up, so its absence is never legitimate.
if full_listing=$(docker compose exec -T bucket mc find local/beacon-saves --name '*.tar.gz' 2>&1); then
  pre_shutdown_listing=$(printf '%s\n' "$full_listing" | grep 'pre-shutdown' || true)
  if [ -n "$pre_shutdown_listing" ]; then
    echo "smoke: a pre-shutdown save already existed before the game stopped: $pre_shutdown_listing" >&2
    exit 1
  fi
else
  echo "smoke: listing local/beacon-saves failed before the game ever stopped: $full_listing" >&2
  exit 1
fi

docker compose stop "$GAME"

# By the time the companion is told STOPPING, a routine push has already run
# at least once: `BEACON_PUSH_INTERVAL_MS` is a threshold the loop only
# checks once per report cycle (REPORT_INTERVAL_MS), so the effective push
# cadence in this stack is that report cycle — sixty seconds — not the
# threshold itself. `saved` is therefore already in the log before this
# point; the origin fake-endpoint.mjs appends to each `saved` line is what
# pins this one to the pre-shutdown push rather than to a routine one.
timeout 120 bash -c "until docker compose exec -T bucket mc find local/beacon-saves/saves/$GAME/pre-shutdown --name '*.tar.gz' 2>/dev/null | grep -q tar.gz; do sleep 2; done" ||
  { echo "smoke: no pre-shutdown archive ever appeared under saves/$GAME/pre-shutdown/" >&2; exit 1; }
grep -q '^saved pre-shutdown$' "$PHASES_LOG"

# A cheap post-condition, not proof of the one-verb channel: this script just
# called `docker compose stop "$GAME"` itself, and `set -e` already means a
# failed stop would have ended the script above it. The assertion that
# actually proves the channel worked is the negative check before the stop.
test "$(docker inspect -f '{{.State.Running}}' "$(docker compose ps -a -q "$GAME")")" = "false"

echo "smoke: the clean shutdown stopped the game, archived, and reported"
