#!/usr/bin/env bash
# Boots the production image on one seeded savegame and records what the game
# leaves behind: usage `./run.sh <scenario>`, the seed read from seeds/<scenario>/.
set -euo pipefail
cd "$(dirname "$0")"

scenario=${1:?usage: ./run.sh <scenario>}
seed=seeds/$scenario
out=out/$scenario
[[ -d $seed ]] || { echo "no seed at $seed" >&2; exit 1; }

docker compose down --timeout 90 >/dev/null 2>&1 || true
rm -rf data/server/savegame "$out"
mkdir -p data/server/savegame "$out"
cp -a "$seed"/. data/server/savegame/
(cd data/server/savegame && ls -la --time-style=full-iso && sha256sum -- * 2>/dev/null || true) > "$out/savegame-before.txt"

docker compose up -d
# The first run downloads the game; later runs only start it.
deadline=$((SECONDS + ${BOOT_TIMEOUT:-1800}))
until docker logs probe-enshrouded 2>&1 | grep -q "HostOnline"; do
  if (( SECONDS > deadline )); then echo "no HostOnline before the deadline" >&2; break; fi
  sleep 10
done
sleep "${PLAY_SECONDS:-120}"
docker compose stop --timeout 90

docker logs probe-enshrouded > "$out/container.log" 2>&1
cp data/server/enshrouded_server.json "$out/" 2>/dev/null || true
cp data/server/logs/*.log "$out/" 2>/dev/null || true
(cd data/server/savegame && find . -type f -printf '%TY-%Tm-%Td %TT %10s %p\n' | sort -k4 && sha256sum $(find . -type f) ) > "$out/savegame-after.txt"
docker compose down >/dev/null
echo "recorded in $out"
