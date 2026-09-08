#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# The entry point's own filter, asked of the catalogue and fed a real trace.
# Nothing else in this repository runs this script: the unit tests read the
# constant it is rendered from, which proves what the string says and not what
# bash does with it. Here it is executed, by its own shebang, against the log a
# measured boot actually produced.
#
# What it must get right, and what each case below pins:
#   - the log comes out byte for byte — this is not a filtered log, it is the
#     only trace a human has of a boot, and it carries the session password
#     three times in the fixture below. Redacting is not this script's job and
#     would be a second thing that can break;
#   - both measured shapes of the announcement are read (probe/RESULTS.md
#     records two, and they disagree);
#   - the identifier reaches the file without the carriage return Wine writes;
#   - a log with nothing to announce leaves no file at all, which is how the
#     probe answers "not ready" for the first two minutes of every boot.

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
  echo "serverid-extraction: $1" >&2
  exit 1
}

# The declared target, not a hand-rederived `WHAT=serverid-filter npx tsx ...`,
# for the same reason run.sh renders its compose through one. FORCE_COLOR=1 and
# nx-target-output.mjs are what make the file that lands here a script and not a
# script wearing an Nx banner — see nx-target-output.mjs for why the colour has
# to be forced rather than detected.
filter="$work/serverid-filter.sh"
FORCE_COLOR=1 npx nx run cloud-init:render-serverid-filter | node ./nx-target-output.mjs > "$filter"
chmod +x "$filter"

# Both fixtures announce the world of `sunkenland.ts` — the guid is half the
# identifier, and an extraction that dropped it would still look plausible.
WORLD_GUID=4db51c84-24cf-459e-9e9e-88b8c3a7ce3b

# The trace of section J of probe/RESULTS.md (lines 938-939), in the noise a
# real boot puts around it: the sentence and the identifier on two separate
# lines, then a status line carrying `ServerID:` — and the session password
# three times over, once in the resolved command line and once per joining
# player. `LOG` is quoted, so every backslash and every `$` below is a byte of
# the fixture and not something bash rewrites.
cat > "$work/two-line.log" <<'LOG'
beacon: launching with -batchmode -nographics -worldGuid 4db51c84-24cf-459e-9e9e-88b8c3a7ce3b -region eu -maxPlayerCapacity 4 -autoSaveIntervalInSeconds 300 -adminSteamIDs 76561197965918116
beacon: password length 5
Start Resolving : Z:\sunkenland\game\Sunkenland-DedicatedServer.exe -batchmode -nographics -region eu -password probe
Auto Save Enabled, auto save interval: 300
AdminSteamIDs: 76561197965918116
NullReferenceException: Object reference not set to an instance of an object
  at SaveManager.get_IsSteamCloudReady()
Server Start Complete, Ready for Clients to Join.
ServerID is '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657'.
WorldName:Beacon's World, ServerID:4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657, Region:eu, IsPublic:True, Current/MaxPlayer 1/4
RPC_ServerValidatePlayer: PlayerRef [1] steamID [76561197965918116] password [probe]
RPC_ServerValidatePlayer: PlayerRef [2] steamID [76561197960287930] password [probe]
LOG

"$filter" "$work/two-line.id" < "$work/two-line.log" > "$work/two-line.copy"

cmp -s "$work/two-line.log" "$work/two-line.copy" ||
  fail "the two-line trace did not come back byte for byte: this filter copies a log, it does not rewrite one"

# The status line of section J comes *after* the announcement and carries the
# same identifier behind `ServerID:` — never behind `ServerID is '`. A marker
# loose enough to match it would leave a truncated value here, over a whole one
# already written, and nothing downstream would say so: the probe would report
# an identifier no player can join with.
printf '%s\n' "$WORLD_GUID~639241566479961657" | cmp -s - "$work/two-line.id" ||
  fail "the two-line trace did not yield the identifier alone: $(cat "$work/two-line.id" 2>/dev/null || echo '<no file>')"

# Section V of probe/RESULTS.md (line 1360): the same announcement with the
# sentence and the identifier on a single line. The two sections disagree, so
# both are exercised — anchoring on either sentence would pass one and silently
# never match the other, and a filter that never matches writes no file, says
# nothing, and lets the session die of the provisioning delay.
cat > "$work/one-line.log" <<'LOG'
World Save File Exist: C:/users/sunkenland/AppData/LocalLow/Vector3 Studio/Sunkenland\Worlds\Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~0.json
Server Start Complete, Ready for Clients to Join. ServerID is '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242318300625638'.
LOG

"$filter" "$work/one-line.id" < "$work/one-line.log" > "$work/one-line.copy"

cmp -s "$work/one-line.log" "$work/one-line.copy" ||
  fail "the one-line trace did not come back byte for byte"

printf '%s\n' "$WORLD_GUID~639242318300625638" | cmp -s - "$work/one-line.id" ||
  fail "the one-line shape of the announcement was not read: $(cat "$work/one-line.id" 2>/dev/null || echo '<no file>')"

# Wine writes CRLF, and the game runs under Wine. An identifier that kept its
# carriage return is one the game's own lobby refuses, and nothing on the way
# would say so — the companion trims what it reads, so the session would simply
# publish a join point that does not work.
printf 'Server Start Complete, Ready for Clients to Join. ServerID is '"'"'%s~639242328214082922'"'"'.\r\n' "$WORLD_GUID" \
  > "$work/crlf.log"

"$filter" "$work/crlf.id" < "$work/crlf.log" > "$work/crlf.copy"

# The copy keeps the carriage return the log had: only the extracted value is
# cleaned, because only that value is read by something other than a human.
cmp -s "$work/crlf.log" "$work/crlf.copy" ||
  fail "the CRLF trace did not come back byte for byte"

printf '%s\n' "$WORLD_GUID~639242328214082922" | cmp -s - "$work/crlf.id" ||
  fail "the carriage return survived into the identifier file"

# Nothing to announce: the ordinary state of the first two minutes of every
# boot, and of a boot that never completes. No file at all is the answer the
# probe reads as "not ready" — an empty one would be as good, but this pins
# which of the two the filter does, so a future rewrite cannot quietly change
# it. The status line is here on its own for the sharpest version of the
# marker check above: alone, with no whole identifier already written, a loose
# marker would write a truncated one and this stack would go green on it.
cat > "$work/silent.log" <<'LOG'
beacon: launching with -batchmode -nographics -worldGuid 4db51c84-24cf-459e-9e9e-88b8c3a7ce3b
beacon: no folder matching 4db51c84-24cf-459e-9e9e-88b8c3a7ce3b under /sunkenland/Worlds
WorldName:Beacon's World, ServerID:4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657, Region:eu, IsPublic:True, Current/MaxPlayer 1/4
LOG

"$filter" "$work/silent.id" < "$work/silent.log" > "$work/silent.copy"

cmp -s "$work/silent.log" "$work/silent.copy" ||
  fail "the trace with nothing to announce did not come back byte for byte"

[ ! -e "$work/silent.id" ] ||
  fail "a log announcing no identifier still wrote one: $(cat "$work/silent.id")"

# Nothing must be left half-written either: the filter writes aside and
# renames, so no `.tmp` may survive a run that ended.
if compgen -G "$work/*.id.tmp" > /dev/null; then
  fail "the filter left a temporary file behind: $(echo "$work"/*.id.tmp)"
fi

echo "serverid-extraction: both measured shapes read, the log copied byte for byte, and silence left no file"
