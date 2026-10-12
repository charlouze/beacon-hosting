#!/usr/bin/env bash
# Local only: the real game container on a named volume, and a second container
# that sees nothing but that volume — what the companion would see.
set -uo pipefail
export MSYS_NO_PATHCONV=1

OUT="$1"
GAME_IMAGE='mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d'
WATCH_IMAGE='node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
NAME=beacon-dl-probe

docker rm -f "$NAME" "$NAME-watch" >/dev/null 2>&1
docker volume rm "$NAME" >/dev/null 2>&1
docker volume create "$NAME" >/dev/null

docker run -d --name "$NAME-watch" -v "$NAME:/data:ro" "$WATCH_IMAGE" sh -c '
  while true; do
    printf "%s du_kb=%s" "$(date -u +%T)" "$(du -sk /data 2>/dev/null | cut -f1)"
    for m in $(find /data -name "appmanifest_*.acf" 2>/dev/null); do
      printf " | %s" "$m"
      for k in StateFlags SizeOnDisk BytesToDownload BytesDownloaded BytesToStage BytesStaged; do
        v=$(grep "\"$k\"" "$m" | head -1 | tr -d "\t\"" | sed "s/$k//")
        printf " %s=%s" "$k" "$v"
      done
    done
    printf "\n"
    sleep 2
  done' >/dev/null

docker run -d --name "$NAME" -v "$NAME:/opt/enshrouded" \
  -e SERVER_NAME=probe -e SERVER_SLOT_COUNT=4 \
  -e SERVER_ROLE_0_NAME=Default -e SERVER_ROLE_0_PASSWORD=probe \
  -e UPDATE_CRON="" "$GAME_IMAGE" >/dev/null

# Until the manifest says fully installed and the size has stopped moving for
# a minute, or twenty minutes at most.
deadline=$(( $(date +%s) + 1200 ))
stable=0; last=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  sleep 10
  line=$(docker logs --tail 1 "$NAME-watch" 2>/dev/null)
  size=$(printf '%s' "$line" | sed -n 's/.*du_kb=\([0-9]*\).*/\1/p')
  if printf '%s' "$line" | grep -q 'StateFlags=4 ' && [ "$size" = "$last" ]; then
    stable=$((stable + 1))
  else
    stable=0
  fi
  last=$size
  [ "$stable" -ge 6 ] && break
done

docker logs "$NAME-watch" > "$OUT/dl-watch.txt" 2>&1
docker logs -t "$NAME" > "$OUT/dl-game.txt" 2>&1
docker run --rm -v "$NAME:/data:ro" "$WATCH_IMAGE" sh -c 'find /data -maxdepth 3 | head -80; echo; for m in $(find /data -name "appmanifest_*.acf"); do echo "== $m"; cat "$m"; done' > "$OUT/dl-tree.txt" 2>&1

docker rm -f "$NAME" "$NAME-watch" >/dev/null 2>&1
docker volume rm "$NAME" >/dev/null 2>&1
echo "finished: $(wc -l < "$OUT/dl-watch.txt") samples"
