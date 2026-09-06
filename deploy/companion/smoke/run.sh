#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Relative, and matching `fake-endpoint.mjs`'s own path: an absolute `/tmp`
# is not the same place for a native Windows node and an MSYS bash on the
# machine of whoever runs this outside CI.
PHASES_LOG=./tmp/beacon-smoke-phases.log
rm -rf ./tmp
rm -f /tmp/roundtrip.tar.gz

# The endpoint the companion reports to. A one-file server, because what is
# under test is the companion and not the Function — which has its own suite
# against the emulator.
node ./fake-endpoint.mjs & endpoint=$!
trap 'kill $endpoint 2>/dev/null || true; docker compose down -v; rm -rf ./tmp' EXIT

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
docker compose up -d game agent

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

original=$(docker compose exec -T game sh -c 'sha256sum /opt/enshrouded/savegame/3ad85aea /opt/enshrouded/savegame/3ad85aea-index' | tr -d '\r')
docker compose stop agent
docker compose run --rm -T --entrypoint sh --no-deps restore -c 'rm -f /opt/enshrouded/savegame/*'
docker compose up --force-recreate --exit-code-from restore restore
recovered=$(docker compose run --rm -T --entrypoint sh --no-deps restore -c 'sha256sum /opt/enshrouded/savegame/3ad85aea /opt/enshrouded/savegame/3ad85aea-index' | tr -d '\r')
test "$original" = "$recovered"
docker compose up -d agent

# 3 — the one the spec names. An empty world produces an archive under the
# floor, and nothing is deposited. The refusal is read directly out of the
# agent's own log, and the container's still running when the wait is over —
# an agent that had simply died would also leave the object count unchanged.
before=$(docker compose exec -T bucket mc ls -r local/beacon-saves | wc -l)
test "$before" -ge 1
docker compose exec -T agent sh -c 'rm -f /opt/enshrouded/savegame/*'
sleep 90
after=$(docker compose exec -T bucket mc ls -r local/beacon-saves | wc -l)
test "$before" -eq "$after"
docker compose logs agent | grep -q 'under the floor of a save'
test "$(docker inspect -f '{{.State.Running}}' "$(docker compose ps -q agent)")" = "true"

echo "smoke: the round trip holds and the empty archive was refused"
