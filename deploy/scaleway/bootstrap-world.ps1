<#
.SYNOPSIS
  Deposits the world a Sunkenland session boots on, as a manual bootstrap save.

.DESCRIPTION
  The dedicated server cannot create a world: without a `-worldGuid` that
  already exists, it stops. The world is made in a player's client and
  deposited here once — a gesture the spec keeps out of the interface (§2, §13)
  because two choices freeze at that instant and never come back: the guid,
  which the players' characters stay attached to, and the folder name, which is
  what they read in the server list and their only recourse if the identifier
  is lost.

  This is the one gesture that needs the saves prefix, which is why it does not
  live in `tools/game-depot`: that tool is kept blind to that address by
  construction (§4), being the one that also owns a purge verb. The game files
  are not this script's business at all — `nx run game-depot:update` deposits
  them, with tests behind it, and guides an operator who has nothing installed
  yet through steamcmd.

  Nothing here deletes anything, ever. Emptying a prefix is the administrator's
  own gesture, in their own shell.

  It needs no credential of its own: rclone signs with the `scw-admin` remote
  it already holds. The machine's key could not do this — it only ever reads
  the games bucket (§7).

.PARAMETER WorldsDir
  The folder that directly contains `<name>~<guid>`. Discovered under the
  client's LocalLow folder when omitted, and pulled from the bucket when this
  machine's client no longer holds the world.

.EXAMPLE
  .\deploy\scaleway\bootstrap-world.ps1
  Finds the world, shows what it found, verifies the archive, and asks before
  depositing.
#>
[CmdletBinding()]
param(
  [string] $WorldsDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "  ok    $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  !     $text" -ForegroundColor Yellow }
function Die($text) { Write-Host "  STOP  $text" -ForegroundColor Red; exit 1 }

function Confirm-Gesture($question) {
  # Every deposit is asked for. A script that uploads on its own is a script
  # somebody runs twice by accident.
  $answer = Read-Host "  $question [o/N]"
  return $answer -in @('o', 'O', 'y', 'Y')
}

# `rclone` is pinned in mise.toml, but a shell where `mise activate` has run
# already carries it on PATH, and going through `mise exec` there spawns a
# process for nothing. Resolved once, in the order
# `tools/game-depot/src/update.ts` already uses: what the shell offers first,
# the pinned version only as the fallback for a shell that never activated.
$RcloneOnPath = [bool](Get-Command rclone -ErrorAction SilentlyContinue)
function Invoke-Rclone {
  if ($RcloneOnPath) { & rclone @args } else { & mise exec -- rclone @args }
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
    # it file by file, under no origin prefix, so `parseObjectKey` rejects it
    # and no restore would ever reach it. Rebuilding the archive from there
    # costs under a megabyte and needs no game client at all.
    Warn "no world under any Worlds/ folder in $localLow"
    $loose = @(Invoke-Rclone lsf --dirs-only scw-admin:beacon-saves/saves/sunkenland 2>$null |
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
    Invoke-Rclone copy "scw-admin:beacon-saves/saves/sunkenland/$worldFolder" (Join-Path $staging $worldFolder)
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
  # `saves/{game}/{origin}/{sessionId}/{instant}.tar.gz`, with `bootstrap`
  # standing where a session id would. Spelled here and built by `objectKeyFor`
  # in libs/scaleway-storage — two places, and nothing fails when they diverge,
  # which is why the shape is written out rather than abbreviated. A colon is
  # legal in an s3 key and unusable in a path, so the instant carries dashes.
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ssZ')
  $key = "saves/sunkenland/manual/bootstrap/$stamp.tar.gz"
  Invoke-Rclone copyto $archive "scw-admin:beacon-saves/$key"
  if ($LASTEXITCODE -ne 0) { Die 'the upload failed' }
  $back = Invoke-Rclone ls "scw-admin:beacon-saves/$key"
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
