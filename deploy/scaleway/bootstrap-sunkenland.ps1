<#
.SYNOPSIS
  Deposits what a Sunkenland session needs before it can ever run: the game
  files, and the world it boots.

.DESCRIPTION
  Task 11 of the tranche 3 bis plan, as a script rather than as prose, because
  every one of its gestures is irreversible in a way a typo does not announce:
  a wrong `tar -C` produces a server that boots on a *fresh* world instead of
  failing, somebody plays an evening in it, and the end-of-evening push makes
  that the most recent save. This script refuses before it deposits, and reads
  back after.

  It never prints a credential. The admin S3 key is read out of the existing
  rclone `scw-admin` remote and handed to `game-depot:push` through the
  environment — the machine's own key cannot do this job, it only ever reads
  the games bucket (§7).

  Nothing here deletes anything. The 247 objects of the old file-by-file
  deposit are left exactly where they are: dropping them is the administrator's
  call, after verifying the archive arrived, and these files under licence can
  only be re-deposited from a machine that owns the game.

.PARAMETER ServerDir
  The Sunkenland *dedicated server* install — not the game client. Discovered
  from the Steam libraries when omitted.

.PARAMETER WorldsDir
  The folder that directly contains `<name>~<guid>`. Discovered under the
  client's LocalLow folder when omitted.

.PARAMETER SkipGameFiles
  Leaves the games bucket alone. Use when `sunkenland/game.tar` is already
  deposited and only the world is being refreshed.

.PARAMETER SkipWorld
  Leaves the saves bucket alone.

.EXAMPLE
  .\deploy\scaleway\bootstrap-sunkenland.ps1
  Discovers both folders, shows what it found, and asks before each deposit.
#>
[CmdletBinding()]
param(
  [string] $ServerDir,
  [string] $WorldsDir,
  [switch] $SkipGameFiles,
  [switch] $SkipWorld
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SERVER_BINARY = 'Sunkenland-DedicatedServer.exe'

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "  ok    $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  !     $text" -ForegroundColor Yellow }
function Die($text) { Write-Host "  STOP  $text" -ForegroundColor Red; exit 1 }

function Confirm-Gesture($question) {
  # Every deposit is asked for. A script that runs a 2.3 GB upload on its own
  # is a script somebody runs twice by accident.
  $answer = Read-Host "  $question [o/N]"
  return $answer -in @('o', 'O', 'y', 'Y')
}

# --- 1. The `$` that would refuse every session, of both games ---------------
#
# `renderCloudInit` refuses any value carrying a `$`: docker compose reads it
# as a variable and swallows what follows, warning about the unknown variable
# and never about the amputated value. Checked here rather than in Secret
# Manager: nothing is deployed yet, so a real session is driven from the
# emulator, which reads apps/functions/.env. That changes when the Functions
# are deployed, and so does this check.

Step 'The values a session carries must hold no dollar sign'
$envFile = Join-Path $RepoRoot 'apps/functions/.env'
if (-not (Test-Path $envFile)) {
  Die "no $envFile — a real session is driven from the emulator, which reads it"
}
$offenders = @()
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*(#|$)') { continue }
  $key, $value = $line -split '=', 2
  if ($value -and $value.Contains('$')) { $offenders += $key }
}
if ($offenders.Count -gt 0) {
  Die ("these carry a dollar sign and no session would provision: " + ($offenders -join ', '))
}
Ok "$((Get-Content $envFile).Count) lines read, none carries one (no value printed)"

# --- 2. The admin key, out of the remote that already holds it ---------------

Step 'The administrator key, never the machine one'
$admin = (mise exec -- rclone config dump | ConvertFrom-Json).'scw-admin'
if (-not $admin) { Die 'no rclone remote named scw-admin' }
foreach ($k in 'endpoint', 'region', 'access_key_id', 'secret_access_key') {
  if (-not $admin.$k) { Die "the scw-admin remote has no $k" }
}
$env:BEACON_S3_ENDPOINT = $admin.endpoint
$env:BEACON_S3_REGION = $admin.region
$env:BEACON_S3_ACCESS_KEY = $admin.access_key_id
$env:BEACON_S3_SECRET_KEY = $admin.secret_access_key
$env:BEACON_GAMES_BUCKET = 'beacon-games'
Ok "scw-admin at $($admin.endpoint), region $($admin.region)"

# --- 3. The game files ------------------------------------------------------

if ($SkipGameFiles) {
  Step 'Game files: skipped'
}
else {
  Step 'The dedicated server install, which is not the game client'

  if (-not $ServerDir) {
    # Every Steam library, not just the default one: an 8 GB client and a
    # 2.3 GB server routinely land on different drives.
    $libraries = @('C:\Program Files (x86)\Steam\steamapps')
    $vdf = 'C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf'
    if (Test-Path $vdf) {
      foreach ($m in Select-String -Path $vdf -Pattern '"path"\s+"(.+?)"') {
        $libraries += Join-Path ($m.Matches[0].Groups[1].Value -replace '\\\\', '\') 'steamapps'
      }
    }
    foreach ($library in ($libraries | Sort-Object -Unique)) {
      $common = Join-Path $library 'common'
      if (-not (Test-Path $common)) { continue }
      foreach ($candidate in Get-ChildItem $common -Directory -ErrorAction SilentlyContinue) {
        if (Test-Path (Join-Path $candidate.FullName $SERVER_BINARY)) {
          $ServerDir = $candidate.FullName
          break
        }
      }
      if ($ServerDir) { break }
    }
  }

  if (-not $ServerDir) {
    Warn "no folder holding $SERVER_BINARY was found in any Steam library."
    Warn 'The dedicated server is a separate Steam entry from the game client:'
    Warn '  Steam > Library > filter "Tools" > Sunkenland Dedicated Server.'
    Warn 'These 2.3 GB are under licence and only a machine that owns the game'
    Warn 'can deposit them (§7 keeps every Steam credential off a game machine).'
    Warn 'Install it, then re-run — or pass -SkipGameFiles if the archive is'
    Warn 'already in the bucket, and -ServerDir to point at it by hand.'
    Die 'nothing deposited'
  }

  if (-not (Test-Path (Join-Path $ServerDir $SERVER_BINARY))) {
    Die "$ServerDir holds no $SERVER_BINARY — that is the game client, not the server"
  }
  $files = Get-ChildItem $ServerDir -Recurse -File
  $gigabytes = ($files | Measure-Object Length -Sum).Sum / 1GB
  Ok ("{0} at {1:N2} GB, {2} files" -f $ServerDir, $gigabytes, $files.Count)
  if ($gigabytes -gt 4) {
    Warn 'that is larger than the 2.3 GB measured — check this is the server and not the client'
  }

  if (Confirm-Gesture "Build the archive and deposit it into beacon-games?") {
    Push-Location $RepoRoot
    try {
      npx nx run game-depot:push -- --game=sunkenland --from="$ServerDir"
      if ($LASTEXITCODE -ne 0) { Die 'game-depot:push failed, nothing to read back' }
    }
    finally { Pop-Location }

    # Read back rather than trust: `pushGameFiles` already compares the size it
    # deposited, this is the second pair of eyes the plan asks for.
    $listing = mise exec -- rclone ls scw-admin:beacon-games/sunkenland/game.tar
    if (-not $listing) { Die 'sunkenland/game.tar is not in the bucket after a push that claimed success' }
    Ok "deposited: $($listing.Trim())"
    Warn 'The 247 objects of the old file-by-file deposit are untouched, deliberately.'
    Warn 'Dropping them is your call, and only after this archive has booted a real session.'
  }
  else { Warn 'skipped' }
}

# --- 4. The bootstrap world -------------------------------------------------

if ($SkipWorld) {
  Step 'World: skipped'
  exit 0
}

Step 'The bootstrap world, whose guid the catalogue must already name'

$fromBucket = $false

if (-not $WorldsDir) {
  # `-steamID` was ruled out on 2026-09-05, so the server reads `Worlds/`
  # directly. The search is anchored on a folder literally named `Worlds`, and
  # that anchor is the whole point: `Characters/` uses the very same
  # `<name>~<guid>` shape, and a looser pattern offers a character where a
  # world was asked for — an archive that restores nothing anybody can play.
  $localLow = Join-Path $env:USERPROFILE 'AppData\LocalLow\Vector3 Studio\Sunkenland'
  $candidates = @()
  if (Test-Path $localLow) {
    foreach ($folder in Get-ChildItem $localLow -Recurse -Directory -Filter 'Worlds' -ErrorAction SilentlyContinue) {
      $candidates += @(Get-ChildItem $folder.FullName -Directory -Filter '*~*' -ErrorAction SilentlyContinue)
    }
  }

  if ($candidates.Count -gt 1) {
    Warn 'several worlds found — pass -WorldsDir to say which parent folder to archive:'
    $candidates | ForEach-Object { Warn "  $($_.FullName)" }
    Die 'ambiguous'
  }

  if ($candidates.Count -eq 1) {
    $WorldsDir = $candidates[0].Parent.FullName
    $worldFolder = $candidates[0].Name
  }
  else {
    # No world on this client, which is the ordinary case once the world lives
    # on the server: the client keeps the characters and drops the world. The
    # bucket is then the only copy, and it holds it loose — the probe deposited
    # it file by file, under no origin prefix, so no restore would ever find
    # it. Rebuilding the archive from there costs under a megabyte and needs
    # no game client at all.
    Warn "no world under any Worlds/ folder in $localLow"
    $loose = @(mise exec -- rclone lsf --dirs-only scw-admin:beacon-saves/saves/sunkenland 2>$null |
      Where-Object { $_ -match '~' })
    if ($loose.Count -ne 1) {
      Die "and the bucket holds $($loose.Count) loose world folders under saves/sunkenland — say which with -WorldsDir"
    }
    $worldFolder = $loose[0].TrimEnd('/')
    Warn "the bucket holds it: $worldFolder"
    if (-not (Confirm-Gesture 'Rebuild the bootstrap archive from the bucket copy?')) { Die 'stopped' }

    $staging = Join-Path $env:TEMP 'beacon-bootstrap-worlds'
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    $null = New-Item -ItemType Directory -Path (Join-Path $staging $worldFolder) -Force
    mise exec -- rclone copy "scw-admin:beacon-saves/saves/sunkenland/$worldFolder" (Join-Path $staging $worldFolder)
    if ($LASTEXITCODE -ne 0) { Die 'the download failed' }
    $WorldsDir = $staging
    $fromBucket = $true
    Ok ("pulled {0} files" -f (Get-ChildItem (Join-Path $staging $worldFolder) -File).Count)
  }
}
else {
  $found = @(Get-ChildItem $WorldsDir -Directory -Filter '*~*')
  if ($found.Count -ne 1) { Die "$WorldsDir must hold exactly one <name>~<guid> folder, found $($found.Count)" }
  $worldFolder = $found[0].Name
}

$worldName, $worldGuid = $worldFolder -split '~', 2
Ok "world `"$worldName`", guid $worldGuid"
Ok "archiving the contents of $WorldsDir"

# The catalogue names the guid it boots with, and the control plane refuses any
# server identifier whose prefix does not match it. A mismatch here means every
# session dies of the provisioning delay with nothing saying why.
$entry = Join-Path $RepoRoot 'deploy/cloud-init/src/lib/sunkenland.ts'
$catalogued = (Select-String -Path $entry -Pattern "WORLD_GUID\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
if ($catalogued -ne $worldGuid) {
  Warn "the catalogue names $catalogued, this world is $worldGuid"
  Warn "edit $entry, then re-run: npx nx test cloud-init"
  Warn 'Without that, the control plane refuses every identifier this machine announces.'
}
else { Ok 'the catalogue already names this guid' }

$archive = Join-Path $env:TEMP 'beacon-bootstrap-world.tar.gz'
if (Test-Path $archive) { Remove-Item $archive }
tar czf $archive -C "$WorldsDir" .
if ($LASTEXITCODE -ne 0) { Die 'tar failed' }

# The dangerous line, verified rather than trusted. An archive built from the
# parent yields `Worlds/Worlds/<world>`, and the server does **not** fail on
# it — it generates a fresh world, somebody plays there, and the evening's push
# becomes the most recent save. The golden rule falls to a misplaced `-C`.
$listing = @(tar tzf $archive | Select-Object -First 3)
Write-Host ("  layout: " + ($listing -join ' | '))
if ($listing -notcontains './') { Die "the archive does not start at ./ — the -C is wrong" }
if ($listing -match '^\./Worlds/') { Die "the archive holds ./Worlds/ — it was built from the parent" }
if (-not ($listing -match [regex]::Escape("./$worldFolder"))) {
  Die "the archive does not hold ./$worldFolder at its root"
}
Ok ("verified, {0:N1} MB" -f ((Get-Item $archive).Length / 1MB))

if (Confirm-Gesture 'Deposit this world as a manual bootstrap save?') {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ssZ')
  $key = "saves/sunkenland/manual/bootstrap/$stamp.tar.gz"
  mise exec -- rclone copyto $archive "scw-admin:beacon-saves/$key"
  if ($LASTEXITCODE -ne 0) { Die 'the upload failed' }
  $back = mise exec -- rclone ls "scw-admin:beacon-saves/$key"
  if (-not $back) { Die "$key is not in the bucket after an upload that claimed success" }
  Ok "deposited: $($back.Trim())"
  Warn 'A manual deposit has no saves/{id} document — only the Function writes those.'
  Warn 'It is invisible to the audit, visible to the restore, and nothing checks its size.'
}
else { Warn 'skipped' }

Remove-Item $archive -ErrorAction SilentlyContinue
if ($fromBucket) {
  Remove-Item (Join-Path $env:TEMP 'beacon-bootstrap-worlds') -Recurse -Force -ErrorAction SilentlyContinue
  Warn "The loose copy at saves/sunkenland/$worldFolder/ is left where it is."
  Warn 'It names no origin, so no restore reaches it and no lifecycle rule prunes it.'
}
Write-Host "`nDone. Next: the two real sessions." -ForegroundColor Cyan
