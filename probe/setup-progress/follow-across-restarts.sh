#!/usr/bin/env bash
# Local only. Can the machine copy a container's output into a file that a
# container without the docker socket then reads?
#   A — what a follower does when the container it follows restarts in a loop
#   B — the real game container: the download progress, read from that file
set -uo pipefail
export MSYS_NO_PATHCONV=1

OUT="$1"
P=beaconlogprobe
GAME_IMAGE='mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d'
NODE_IMAGE='node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
CLI_IMAGE='docker:29-cli'

cleanup() {
  docker compose -p "$P" -f "$OUT/flap-compose.yml" down -t 1 >/dev/null 2>&1
  docker rm -f "$P-game" "$P-follow" "$P-read" >/dev/null 2>&1
  docker volume rm "$P-data" "$P-log" >/dev/null 2>&1
}
cleanup

# ---------------------------------------------------------------- A
cat > "$OUT/flap-compose.yml" <<'YML'
services:
  game:
    image: alpine:3.20
    container_name: beaconlogprobe-flap
    restart: unless-stopped
    command: ["sh", "-c", "echo \"boot $$(date -u +%T)\"; sleep 4; echo dying; exit 1"]
YML

# A follower asked before the container exists.
docker logs -f "$P-flap" > "$OUT/a0.txt" 2>&1; echo "exit=$?" >> "$OUT/a0.txt"

docker compose -p "$P" -f "$OUT/flap-compose.yml" up -d >/dev/null 2>&1
{ docker logs -f "$P-flap" > "$OUT/a1.txt" 2>&1; echo "exit=$? at $(date -u +%T)" > "$OUT/a1.exit"; } &
{ timeout 70 docker compose -p "$P" -f "$OUT/flap-compose.yml" logs -f --no-color --no-log-prefix game > "$OUT/a2.txt" 2>&1; echo "exit=$? at $(date -u +%T)" > "$OUT/a2.exit"; } &
sleep 40
echo "restarts=$(docker inspect -f '{{.RestartCount}}' "$P-flap") at $(date -u +%T)" > "$OUT/a-state.txt"
docker compose -p "$P" -f "$OUT/flap-compose.yml" down -t 1 >/dev/null 2>&1
echo "down at $(date -u +%T)" >> "$OUT/a-state.txt"
sleep 5
wait

# ---------------------------------------------------------------- B
docker volume create "$P-data" >/dev/null
docker volume create "$P-log" >/dev/null

docker run -d --name "$P-game" -v "$P-data:/opt/enshrouded" \
  -e SERVER_NAME=probe -e SERVER_SLOT_COUNT=4 \
  -e SERVER_ROLE_0_NAME=Default -e SERVER_ROLE_0_PASSWORD=probe \
  -e UPDATE_CRON="" "$GAME_IMAGE" >/dev/null
echo "game started $(date -u +%T)" > "$OUT/b-state.txt"

# The machine: the only thing here that holds the socket.
docker run -d --name "$P-follow" \
  -v /var/run/docker.sock:/var/run/docker.sock -v "$P-log:/log" "$CLI_IMAGE" \
  sh -c "docker logs -f $P-game > /log/game.log 2>&1" >/dev/null

# The companion: the log file and the game folder, read-only, no socket.
docker run -d --name "$P-read" -v "$P-log:/log:ro" -v "$P-data:/data:ro" "$NODE_IMAGE" sh -c '
  while true; do
    line=$(grep "progress:" /log/game.log 2>/dev/null | tail -1)
    printf "%s log_bytes=%s du_kb=%s | %s\n" "$(date -u +%T)" \
      "$(wc -c < /log/game.log 2>/dev/null)" "$(du -sk /data 2>/dev/null | cut -f1)" "$line"
    sleep 2
  done' >/dev/null

deadline=$(( $(date +%s) + 1200 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  sleep 10
  docker exec "$P-read" grep -q "enshrouded-server: started" /log/game.log 2>/dev/null && break
done
sleep 20
echo "stopped watching $(date -u +%T)" >> "$OUT/b-state.txt"

docker logs "$P-read" > "$OUT/b-read.txt" 2>&1
docker exec "$P-read" cat /log/game.log > "$OUT/b-game-file.txt" 2>&1
docker logs "$P-game" > "$OUT/b-game-docker.txt" 2>&1

cleanup
echo "finished"
