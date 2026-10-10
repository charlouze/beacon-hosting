#!/usr/bin/env bash
set -uo pipefail

# Measures whether a mounted entry point can write AdminSteamIDs.txt into a
# restored world under real Linux permissions. Docker Desktop with a Windows
# folder mounted applies none, so the world goes into a named volume here, and
# is seeded the way the companion restores it: copied as root, then
# `chown -R 7000:7000`.
#
#   WORLD_FILES=C:/path/to/Worlds [GAME_FILES=C:/path/to/dedicated-server] \
#     bash probe/sunkenland/admin-file-permissions.sh
#
# WORLD_FILES is only read. GAME_FILES is optional: without it the last case,
# the real start.sh, is skipped.

IMAGE=melle2/sunkenland-ds@sha256:2b21e6f098c76f8da91a7c5f53e02ceb9af126fa93d05f7958fd189d759873b7
WORLD_DIR=/sunkenland/Worlds
WORLD_GUID=${WORLD_GUID:-4db51c84-24cf-459e-9e9e-88b8c3a7ce3b}
SERVER_OWNER=7000:7000
ADMIN_FILE=AdminSteamIDs.txt

# ---------------------------------------------------------------------------
# Inside the game container: this same file, mounted, is the entry point — the
# way production mounts start.sh over the image's own.
# ---------------------------------------------------------------------------

attempt() {
  local label=$1
  shift
  "$@"
  printf '  %-34s exit %s\n' "$label" "$?"
}

write_file() { printf '%s\n' "$1" > "$2"; }

show() {
  if [[ -e $1 ]]; then
    stat -c '  -> %u:%g %a %n' "$1"
  else
    printf '  -> absent\n'
  fi
}

inside() {
  folders=("$WORLD_DIR"/*"$WORLD_GUID")
  local folder=${folders[0]}
  local file=$folder/$ADMIN_FILE
  printf '  id: %s\n  umask: %s\n' "$(id)" "$(umask)"
  stat -c '  folder: %u:%g %a' "$folder"
  show "$file"
  case $1 in
    create-overwrite-remove)
      attempt 'create with >' write_file 111 "$file"; show "$file"
      attempt 'overwrite with >' write_file 222 "$file"; show "$file"
      attempt 'rm -f' rm -f "$file"; show "$file"
      ;;
    overwrite-then-replace)
      attempt 'overwrite with >' write_file 222 "$file"; show "$file"
      attempt 'rm -f' rm -f "$file"; show "$file"
      attempt 'create with >' write_file 333 "$file"; show "$file"
      ;;
  esac
}

if [[ ${1:-} == --inside ]]; then
  inside "$2"
  exit 0
fi

# ---------------------------------------------------------------------------
# On the host.
# ---------------------------------------------------------------------------

: "${WORLD_FILES:?WORLD_FILES is required: the host folder holding the world folder}"

# Git Bash rewrites anything that looks like a POSIX path, container paths
# included.
export MSYS_NO_PATHCONV=1

here=$(cd "$(dirname "$0")" && (pwd -W 2> /dev/null || pwd))
suffix=$$
volume=beacon-probe-admin-file-$suffix
container=beacon-probe-admin-file-$suffix

cleanup() {
  docker rm -f "$container" > /dev/null 2>&1
  docker volume rm -f "$volume" > /dev/null 2>&1
}
trap cleanup EXIT

docker volume create "$volume" > /dev/null

# What the restore does, as root. The copy never carries an existing admin
# file, and modes are forced because the Windows mount reports 0777 for
# everything: 0755 and 0644 stand for an archive written by the game.
as_root() {
  docker run --rm --user 0:0 --entrypoint bash \
    -e WORLD_DIR="$WORLD_DIR" -e WORLD_GUID="$WORLD_GUID" -e ADMIN_FILE="$ADMIN_FILE" \
    -v "$WORLD_FILES:/src:ro" -v "$volume:$WORLD_DIR" \
    "$IMAGE" -c "set -e; folders=(\"\$WORLD_DIR\"/*\"\$WORLD_GUID\"); folder=\${folders[0]}; file=\$folder/\$ADMIN_FILE; $1"
}

restore() {
  as_root "find \"\$WORLD_DIR\" -mindepth 1 -delete
    cp -r /src/. \"\$WORLD_DIR\"/
    find \"\$WORLD_DIR\" -name \"\$ADMIN_FILE\" -delete
    find \"\$WORLD_DIR\" -type d -exec chmod 0755 {} +
    find \"\$WORLD_DIR\" -type f -exec chmod 0644 {} +
    ${1:-chown -R $SERVER_OWNER \"\$WORLD_DIR\"}" 2> /dev/null
}

# No `--user`, entry point replaced by a mounted script: production's compose.
as_entrypoint() {
  docker run --rm --entrypoint /opt/beacon/probe.sh \
    -e WORLD_DIR="$WORLD_DIR" -e WORLD_GUID="$WORLD_GUID" -e ADMIN_FILE="$ADMIN_FILE" \
    -v "$here/admin-file-permissions.sh:/opt/beacon/probe.sh:ro" -v "$volume:$WORLD_DIR" \
    "$IMAGE" --inside "$1"
  printf '  container exit %s\n' "$?"
}

printf '\n== 1-2 · restored world, no admin file\n'
restore
as_entrypoint create-overwrite-remove

printf '\n== 3 · admin file present, %s, mode 0444\n' "$SERVER_OWNER"
restore
as_root "echo 000 > \"\$file\"; chown $SERVER_OWNER \"\$file\"; chmod 0444 \"\$file\""
as_entrypoint overwrite-then-replace

printf '\n== 4 · admin file present, root:root, mode 0644, folder %s\n' "$SERVER_OWNER"
restore
as_root "echo 000 > \"\$file\"; chown 0:0 \"\$file\"; chmod 0644 \"\$file\""
as_entrypoint overwrite-then-replace

printf '\n== 5a · no chown at all, no admin file\n'
restore true
as_entrypoint create-overwrite-remove

printf '\n== 5b · no chown at all, admin file present, root:root, mode 0644\n'
restore true
as_root "echo 000 > \"\$file\"; chmod 0644 \"\$file\""
as_entrypoint overwrite-then-replace

printf '\n== 6 · the real start.sh\n'
if [[ -z ${GAME_FILES:-} ]]; then
  printf '  skipped: GAME_FILES is not set\n'
  exit 0
fi
restore
docker run -d --name "$container" --entrypoint /opt/beacon/start.sh \
  -e WORLD_GUID="$WORLD_GUID" -e GAME_PASSWORD=probe \
  -e ADMIN_FILE_STEAM_IDS="${ADMIN_FILE_STEAM_IDS:-76561190000000001,76561190000000002}" \
  -v "$here/start.sh:/opt/beacon/start.sh:ro" \
  -v "$GAME_FILES:/sunkenland/game:ro" \
  -v "$volume:$WORLD_DIR" \
  "$IMAGE" > /dev/null

# start.sh writes the file before it launches anything, so the line comes
# within seconds or the script has already exited.
for _ in $(seq 1 30); do
  if docker logs "$container" 2>&1 | grep -q 'beacon: wrote\|beacon: no world folder'; then break; fi
  if [[ $(docker inspect -f '{{.State.Running}}' "$container") != true ]]; then break; fi
  sleep 1
done
docker logs "$container" 2>&1 | grep '^beacon:\|ermission denied' | sed 's/^/  /'
docker exec "$container" bash -c "printf '  id: %s\n' \"\$(id)\"; stat -c '  -> %u:%g %a %n' $WORLD_DIR/*$WORLD_GUID/$ADMIN_FILE; od -c $WORLD_DIR/*$WORLD_GUID/$ADMIN_FILE | sed 's/^/  /'"
printf '  exec exit %s\n' "$?"
docker stop -t 90 "$container" > /dev/null
printf '  container exit %s\n' "$(docker inspect -f '{{.State.ExitCode}}' "$container")"
