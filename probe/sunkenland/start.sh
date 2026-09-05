#!/usr/bin/env bash
set -euo pipefail

# Never SteamCMD. This game's dedicated server needs an account that owns the
# licence, and §7 keeps every Steam credential off the game machine: the files
# are restored from object storage, exactly like a save.
GAME_DIR=${GAME_DIR:-/sunkenland/game}
WORLD_DIR=${WORLD_DIR:-/sunkenland/Worlds}
GAME_PASSWORD=${GAME_PASSWORD:-}

# The server cannot create a world — without an existing guid it stops. Failing
# here beats failing three minutes into a boot with an unreadable message.
: "${WORLD_GUID:?WORLD_GUID is required: this server cannot create a world}"

# A warning and not a failure: what the server does when it cannot find its
# world is itself one of the things being measured, and a script that refuses to
# start would hide it.
if ! compgen -G "$WORLD_DIR/*$WORLD_GUID" > /dev/null; then
  printf 'beacon: no folder matching %s under %s\n' "$WORLD_GUID" "$WORLD_DIR"
fi

args=(
  -batchmode
  -nographics
  -worldGuid "$WORLD_GUID"
  -region "${REGION:-eu}"
  -maxPlayerCapacity "${MAX_PLAYERS:-4}"
  -autoSaveIntervalInSeconds "${AUTOSAVE_SECONDS:-300}"
)

# The argument form wins over the file form — the binary logs "FromBatScript
# AdminSteamIDs:" — and it is the only one that keeps a restored world pure
# data. Beacon never writes inside a save folder.
if [[ -n "${ADMIN_STEAM_IDS:-}" ]]; then
  args+=(-adminSteamIDs "$ADMIN_STEAM_IDS")
fi

# The three this probe exists to answer, plus the one that decides how a world
# is bootstrapped. All absent by default: the first run has to show what happens
# when nothing is announced.
if [[ -n "${GAME_PORT:-}" ]]; then args+=(-port "$GAME_PORT"); fi
if [[ -n "${PUBLIC_IP:-}" ]]; then args+=(-publicip "$PUBLIC_IP"); fi
if [[ -n "${PUBLIC_PORT:-}" ]]; then args+=(-publicport "$PUBLIC_PORT"); fi
if [[ -n "${STEAM_ID:-}" ]]; then args+=(-steamID "$STEAM_ID"); fi

# Printed so the measurement can be read back from the log without guessing what
# the container was told.
printf 'beacon: launching with %s\n' "${args[*]}"

# The password itself never goes on this line, but its length does: compose eats
# a `$` on the way in, and a password silently shortened is the one failure that
# looks exactly like a player typing it wrong. Section J's log leaks the whole
# password on every join anyway — a length adds nothing to that.
printf 'beacon: password length %s\n' "${#GAME_PASSWORD}"

# Appended after the trace, and that is the whole reason it comes last: this log
# already leaks the password once per joining player (section J), and the launch
# line does not add a second. Only when it holds something — upstream passes it
# unconditionally, and an empty value makes the parser swallow the next option:
# the password becomes literally "-region", with HasPassword true.
if [[ -n "$GAME_PASSWORD" ]]; then
  args+=(-password "$GAME_PASSWORD")
fi

# From here on, upstream's own launch sequence, kept verbatim except for the
# arguments. The image bakes DISPLAY=:1 and starts its X server through an init
# script rather than xvfb-run: reproducing that is what makes this run the same
# experiment as section J's.
[ -f /tmp/.X1-lock ] && rm -f /tmp/.X1-lock

# And its teardown, for the same reason plus one of our own: as PID 1 a process
# with no handler never receives SIGTERM at all, so an `exec` here would turn
# every `docker stop` into a ten-second wait then SIGKILL — possibly in the
# middle of an autosave, on the one folder this system cannot rebuild.
_terminate() {
  echo 'beacon: caught TERM, stopping'
  wineserver -k -w
  /etc/init.d/xvfb stop
}
trap _terminate HUP INT QUIT TERM

/etc/init.d/xvfb start

cd "$GAME_DIR"
wine "$GAME_DIR/Sunkenland-DedicatedServer.exe" "${args[@]}" &
wait
