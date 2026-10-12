#!/usr/bin/env bash
# Local only, nothing billed. Can the machine copy the game container's output
# into a file, with the command the machine would really run — the compose
# follower — and can a container that holds no docker socket read the download
# progress from that file?
#
#   bash probe/setup-progress/game-log-follow.sh <output directory>
#
# Measures, on the real image of the game that downloads itself:
#   1. what the follower does when asked before the container exists
#   2. that the file it writes is what `docker logs` holds
#   3. that the progress lines are readable from the file as they arrive
#   4. that the follower survives a restart of the game container
set -uo pipefail
export MSYS_NO_PATHCONV=1

OUT="$1"
mkdir -p "$OUT"
P=beaconfollowprobe
GAME_IMAGE='mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d'
NODE_IMAGE='node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
CLI_IMAGE='docker:29-cli'
FOLLOW="docker compose -p $P -f /probe/compose.yml logs -f --no-color --no-log-prefix game"

cat > "$OUT/compose.yml" <<YML
services:
  game:
    image: $GAME_IMAGE
    container_name: $P-game
    restart: unless-stopped
    environment:
      SERVER_NAME: probe
      SERVER_SLOT_COUNT: "4"
      SERVER_ROLE_0_NAME: Default
      SERVER_ROLE_0_PASSWORD: probe
      UPDATE_CRON: ""
    volumes:
      - data:/opt/enshrouded
volumes:
  data:
    name: $P-data
YML

cleanup() {
  docker rm -f "$P-follow" "$P-read" "$P-early" >/dev/null 2>&1
  docker compose -p "$P" -f "$OUT/compose.yml" down -t 5 -v >/dev/null 2>&1
  docker volume rm "$P-log" >/dev/null 2>&1
}
cleanup
docker volume create "$P-log" >/dev/null

# 1 — asked before the container exists
docker run --name "$P-early" -v /var/run/docker.sock:/var/run/docker.sock -v "$OUT:/probe:ro" \
  "$CLI_IMAGE" sh -c "timeout 20 $FOLLOW; echo \"exit=\$?\"" > "$OUT/1-before-it-exists.txt" 2>&1
docker rm -f "$P-early" >/dev/null 2>&1

docker compose -p "$P" -f "$OUT/compose.yml" up -d > "$OUT/up.txt" 2>&1
echo "up returned $(date -u +%T)" > "$OUT/timeline.txt"

# The machine: the only thing here that holds the socket.
docker run -d --name "$P-follow" \
  -v /var/run/docker.sock:/var/run/docker.sock -v "$OUT:/probe:ro" -v "$P-log:/log" "$CLI_IMAGE" \
  sh -c "$FOLLOW > /log/game.log 2>&1; echo \"exit=\$? at \$(date -u +%T)\" > /log/follower.exit" >/dev/null

# The companion: the file, read-only, and no socket.
docker run -d --name "$P-read" -v "$P-log:/log:ro" "$NODE_IMAGE" sh -c '
  while true; do
    printf "%s lines=%s | %s\n" "$(date -u +%T)" "$(wc -l < /log/game.log 2>/dev/null)" \
      "$(grep "downloading, progress:" /log/game.log 2>/dev/null | tail -1 | cut -c1-110)"
    sleep 2
  done' >/dev/null

deadline=$(( $(date +%s) + 1200 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  sleep 10
  docker exec "$P-read" grep -q "enshrouded-server: started" /log/game.log 2>/dev/null && break
done
echo "server started seen $(date -u +%T)" >> "$OUT/timeline.txt"

# 2 — the file against what docker holds, before anything restarts
docker exec "$P-read" cat /log/game.log > "$OUT/2-file.txt" 2>&1
docker logs "$P-game" > "$OUT/2-docker-logs.txt" 2>&1

# 4 — a restart of the game container
before=$(docker exec "$P-read" sh -c 'wc -l < /log/game.log')
docker restart -t 20 "$P-game" >/dev/null 2>&1
echo "restarted $(date -u +%T), file had $before lines" >> "$OUT/timeline.txt"
sleep 45
after=$(docker exec "$P-read" sh -c 'wc -l < /log/game.log')
{
  echo "file has $after lines 45 s after the restart"
  echo "follower: $(docker inspect -f '{{.State.Status}}' "$P-follow")"
  docker exec "$P-read" cat /log/follower.exit 2>/dev/null || echo "follower has not exited"
} > "$OUT/4-after-restart.txt" 2>&1
docker exec "$P-read" sh -c "sed -n '$before,\$p' /log/game.log | head -12" > "$OUT/4-first-lines-after-restart.txt" 2>&1

docker logs "$P-read" > "$OUT/3-read.txt" 2>&1
cleanup
echo finished
