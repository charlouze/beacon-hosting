import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogFor, refuseWorldLayout, renderCloudInit, renderCompose } from './catalog.js';
import { REQUEST, serviceBlock } from './catalogue-fixtures.spec-helper.js';
import { SERVERID_FILTER, sunkenland } from './sunkenland.js';

/**
 * The filter is bash, and reading it proves nothing about what it matches: the
 * defect it was written against was a marker that simply never appeared. So it
 * gets run. Relative names and a cwd, because a Windows path handed to a POSIX
 * shell as an argument is a second thing to be wrong about.
 */
function runFilter(log: string): { copied: string; written: string | null } {
  const dir = mkdtempSync(join(tmpdir(), 'beacon-serverid-'));
  writeFileSync(join(dir, 'filter.sh'), SERVERID_FILTER);
  const run = spawnSync('bash', ['filter.sh', 'serverid'], { cwd: dir, input: log, encoding: 'utf8' });
  expect(run.status).toBe(0);
  try {
    return { copied: run.stdout, written: readFileSync(join(dir, 'serverid'), 'utf8') };
  } catch {
    return { copied: run.stdout, written: null };
  }
}

/**
 * La derivation du monde est du bash, et la lire ne prouve rien : le defaut
 * qu'elle porte est un glob qui compte un fichier pour un dossier. Elle est
 * donc extraite du script rendu et executee sur un vrai dossier — le meme
 * decoupage que `runFilter`, pour la meme raison.
 */
function runWorldDerivation(entries: readonly { name: string; directory: boolean }[]): {
  status: number | null;
  output: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'beacon-worlds-'));
  mkdirSync(join(dir, 'worlds'));
  for (const entry of entries) {
    if (entry.directory) mkdirSync(join(dir, 'worlds', entry.name));
    else writeFileSync(join(dir, 'worlds', entry.name), '');
  }

  const lines = sunkenland
    .render(REQUEST)
    .split('\n')
    .map((line) => line.replace(/^ {6}/, ''));
  const start = lines.indexOf('shopt -s nullglob');
  const end = lines.findIndex((line) => line.includes('beacon: opening'));
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const fragment = ['set -uo pipefail', 'WORLD_DIR=worlds', ...lines.slice(start, end + 1)].join('\n');

  writeFileSync(join(dir, 'derive.sh'), fragment);
  const run = spawnSync('bash', ['derive.sh'], { cwd: dir, encoding: 'utf8' });
  return { status: run.status, output: run.stdout + run.stderr };
}

const GUID = '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b';

describe('la derivation du monde sur la machine', () => {
  it('ouvre le monde pose, espace et apostrophe compris', () => {
    const run = runWorldDerivation([{ name: `Beacon's World~${GUID}`, directory: true }]);
    expect(run.status).toBe(0);
    expect(run.output).toContain(`beacon: opening Beacon's World~${GUID}`);
  });

  // Le glob n'est pas un glob de dossiers : un fichier pose a cote du monde
  // faisait compter deux, et la session mourait du delai d'approvisionnement
  // avec `found 2` au fond d'un journal.
  it('ne compte pas un fichier pose a cote du monde', () => {
    const run = runWorldDerivation([
      { name: `Beacon's World~${GUID}`, directory: true },
      { name: 'notes~1.txt', directory: false },
    ]);
    expect(run.status).toBe(0);
    expect(run.output).toContain(`beacon: opening Beacon's World~${GUID}`);
  });

  it('refuse deux dossiers, parce qu il n arbitre pas', () => {
    const run = runWorldDerivation([
      { name: `Beacon's World~${GUID}`, directory: true },
      { name: 'Charlouze~5eb62c95-35df-56af-af9f-99c4d8b4cd4c', directory: true },
    ]);
    expect(run.status).toBe(1);
  });

  it('refuse un dossier vide', () => {
    expect(runWorldDerivation([]).status).toBe(1);
  });

  // Le nom d'un monde peut porter un tilde : c'est le dernier qui separe.
  it('prend le dernier tilde quand le nom du monde en porte un', () => {
    const run = runWorldDerivation([{ name: `A~B~${GUID}`, directory: true }]);
    expect(run.status).toBe(0);
    expect(run.output).toContain(`beacon: opening A~B~${GUID}`);
  });
});

describe('the sunkenland catalogue entry', () => {
  // §10, on the image we borrow exactly as on our own.
  it('pins both images by digest and never by tag', () => {
    const compose = renderCompose('sunkenland');
    expect(compose).toContain('melle2/sunkenland-ds@sha256:');
    expect(compose).toContain('ghcr.io/charlouze/beacon-companion@sha256:');
    expect(compose).not.toContain(':latest');
  });

  // §2: our script replaces the image's entry point, mounted and not baked.
  // That is what spares this repository a fork and an image of its own.
  it('replaces the image entrypoint with a mounted script, never a baked one', () => {
    const compose = renderCompose('sunkenland');
    expect(serviceBlock(compose, 'sunkenland')).toContain('entrypoint: ["/opt/beacon/start.sh"]');
    expect(serviceBlock(compose, 'sunkenland')).toContain('/opt/beacon/start.sh:ro');
  });

  // Measured 2026-09-05: listening on 27015 without any -port having been passed.
  it('publishes the one udp port measured, and only it', () => {
    expect(serviceBlock(renderCompose('sunkenland'), 'sunkenland')).toContain('"27015:27015/udp"');
  });

  // §6 étape 7, protection before convenience: until the restore exits zero
  // there is no game container, so nobody can play in a blank world that would
  // then be saved over the real one.
  it('makes the game wait for a restore that succeeded', () => {
    expect(renderCompose('sunkenland')).toMatch(
      /sunkenland:[\s\S]*depends_on:[\s\S]*restore:[\s\S]*condition: service_completed_successfully/,
    );
  });

  // §7: these 2.3 GB are licensed, deposited once, and nothing on a game
  // machine has to rewrite them. The restore writes them, the game reads them.
  it('mounts the game files writable for the restore and read-only for the game', () => {
    const compose = renderCompose('sunkenland');
    expect(serviceBlock(compose, 'restore')).toContain('./game:/sunkenland/game\n');
    expect(serviceBlock(compose, 'sunkenland')).toContain('./game:/sunkenland/game:ro');
  });

  // The identifier crosses a frontier and the log crosses none: the game
  // writes, the agent reads, and nothing else passes.
  it('gives the game a folder to announce itself in, and the agent only reading rights on it', () => {
    const compose = renderCompose('sunkenland');
    expect(serviceBlock(compose, 'sunkenland')).toContain('./ready:/opt/beacon/ready\n');
    expect(serviceBlock(compose, 'agent')).toContain('./ready:/opt/beacon/ready:ro');
  });

  // §7: the one-verb channel stays the companion's. The game container has
  // nothing to ask of the host.
  it('keeps the one-verb channel out of the game container', () => {
    expect(serviceBlock(renderCompose('sunkenland'), 'sunkenland')).not.toContain(
      '/opt/beacon/control',
    );
  });

  // Measured: the server runs as uid 7000. Without this owner the autosave
  // writes nothing and the failure is mute — invisible on Docker Desktop,
  // fatal on a Linux vm.
  it('hands the restored folders to the uid the server runs as', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain('BEACON_SAVE_OWNER=7000:7000');
  });

  // The world lives where the image expects its symlink. A wrong value here
  // pushes an empty folder all evening, without saying anything.
  it('points the save dir where the compose actually mounts the world', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain('BEACON_SAVE_DIR=/sunkenland/Worlds');
  });

  // §2: this game does not download itself, it is restored. One archive, one
  // get, the same code path as a save.
  it('tells the companion which archive holds the game and where to unpack it', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('BEACON_GAME_FILES_KEY=sunkenland/game.tar');
    expect(rendered).toContain('BEACON_GAME_DIR=/sunkenland/game');
  });

  // §6: this game's probe reads an identifier, it does not query a port.
  it('tells the companion how readiness is observed for this game', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain(
      'BEACON_READY_PROBE=serverid:///opt/beacon/ready/serverid',
    );
  });

  // §4: the push cadence follows what the game writes — five minutes here.
  it('pushes at the cadence this game writes at', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain('BEACON_PUSH_INTERVAL_MS=300000');
  });

  // The options the probe kept, and the cadence the binary logs verbatim:
  // `Auto Save Enabled, auto save interval: 300`.
  it('launches with the options measured, and with the world it was given', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('-worldGuid');
    expect(rendered).toContain('-autoSaveIntervalInSeconds 300');
    expect(rendered).toContain('-region eu');
  });

  // Measured behind a real NAT: with none of these options, a player finds the
  // server in the list and joins it. Carrying them would announce an address
  // this game does not use.
  it('announces no address at all', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    for (const option of ['-publicip', '-publicport', '-steamID']) {
      expect(rendered).not.toContain(option);
    }
  });

  // Measured: as PID 1 a process with no handler never receives SIGTERM. An
  // `exec` would turn every docker stop into ten seconds then a SIGKILL,
  // possibly in the middle of a save.
  it('keeps the upstream trap, and never execs into the server', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('trap _terminate HUP INT QUIT TERM');
    expect(rendered).toContain('wineserver -k -w');
    expect(rendered).not.toMatch(/exec wine /);
  });

  // The second literal spanning two projects that cannot import each other:
  // `tools/game-depot` refuses to deposit 2.3 GB from a folder that does not
  // hold this file, and this is the name wine is given. Its twin there pins the
  // same string, and nothing else ties the two — the smoke barrier runs a stub
  // game and never executes this line. A drift reaches production mute: no
  // server, no identifier in the log, no join point, and a session that dies of
  // the provisioning delay with nothing saying why.
  it('launches the very binary the depot refuses to push without', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain(
      'wine "$GAME_DIR/Sunkenland-DedicatedServer.exe"',
    );
  });

  // The filter that writes the one line leaving this container. A rename and
  // not a write in place: a reader runs next to it every thirty seconds.
  it('writes the identifier through a rename, never in place', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain(`marker="ServerID is '"`);
    expect(rendered).toContain('/opt/beacon/ready/serverid');
    expect(rendered).toMatch(/mv .*serverid\.tmp.*serverid/);
  });

  // `probe/RESULTS.md` measured this announcement twice, and the two shapes
  // disagree: section J spreads it over three lines, section V puts it on one.
  // A marker carrying the whole sentence bets on section V — under section J it
  // matches nothing, no file is ever written, the probe stays "not ready", and
  // the session dies of the provisioning delay with nothing saying why. So the
  // shape that would defeat it is the one fed in here, third line included:
  // that line carries `ServerID:`, and must neither match nor overwrite what
  // the line before it wrote.
  it('extracts the identifier from the log shape that would defeat a longer marker', () => {
    const log = [
      'Server Start Complete, Ready for Clients to Join.',
      `ServerID is '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657'.`,
      "WorldName:Beacon's World, ServerID:4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657, Region:eu, IsPublic:True, Current/MaxPlayer 0/4",
      '',
    ].join('\n');

    const { copied, written } = runFilter(log);

    expect(written).toBe('4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241566479961657\n');
    // Byte for byte: this is not a filtered log, it is the log, out of which
    // one value is taken.
    expect(copied).toBe(log);
  });

  // The other measured shape, section V's, on the single line the probe saw.
  it('extracts the same identifier when the announcement arrives on one line', () => {
    const { written } = runFilter(
      `Server Start Complete, Ready for Clients to Join. ServerID is '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242328214082922'.\n`,
    );
    expect(written).toBe('4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242328214082922\n');
  });

  // Nothing announced yet: no file at all, which is what the probe reads as
  // "not ready". A file holding an empty line would read the same, but only by
  // accident.
  it('writes nothing at all while the boot has not announced itself', () => {
    expect(runFilter('beacon: launching with -batchmode\n').written).toBeNull();
  });

  // The one measured case, byte for byte as the constant rendered it. What was
  // proved on 2026-09-05 was a save triggered from the game console by this
  // account, and nothing about the shape of a list.
  it('renders one administrator exactly as the constant did', () => {
    const rendered = renderCloudInit('sunkenland', {
      ...REQUEST,
      adminSteamIds: ['76561197965918116'],
    });
    expect(rendered).toContain('\n        -adminSteamIDs 76561197965918116\n');
  });

  // Unmeasured: no probe ever passed two. A comma is the guess, and the plan
  // says so out loud rather than letting a reader assume it was tested.
  it('joins several administrators with a comma', () => {
    const rendered = renderCloudInit('sunkenland', {
      ...REQUEST,
      adminSteamIds: ['11111111111111111', '76561197965918116'],
    });
    expect(rendered).toContain('-adminSteamIDs 11111111111111111,76561197965918116');
  });

  // An empty option is not the same as no option, and a flag with no value is
  // how a command line starts eating the argument that follows it.
  it('leaves the option out when nobody declared an identifier', () => {
    const rendered = renderCloudInit('sunkenland', { ...REQUEST, adminSteamIds: [] });
    expect(rendered).not.toContain('-adminSteamIDs');
  });

  // The `$` compose swallows is refused at the frontier and no longer here —
  // `catalog.spec.ts` holds it, for both games and every value that reaches a
  // machine. What stays here is the second defense, because neither covers both
  // paths: the length at launch is the only thing that can be read back when
  // the password itself cannot.
  it('prints the password length at launch, and never the password', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('beacon: password length');
    expect(rendered).not.toMatch(/printf .*GAME_PASSWORD"?\\n/);
  });

  // The stop unit can no longer name a game in hard: there are two.
  it('gives the host a unit that stops this game and no other', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain(
      'ExecStart=-/usr/bin/docker stop -t 90 sunkenland',
    );
  });

  // §7: what the companion can obtain is what its s3 key allows, and nothing
  // more.
  it('mounts no docker socket anywhere', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).not.toContain('docker.sock');
  });

  // A marker left behind is a hole in a document that still looks like a
  // document: cloud-init runs, and the machine boots on a literal.
  it('leaves no marker of its own behind', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).not.toContain('__');
  });

  // The compose travels as a block scalar: its depth is its syntax. A line
  // landing short closes the block, and everything after it becomes cloud-init
  // keys nobody wrote.
  it('lays the compose inside the block scalar, every line at its own depth', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('    content: |\n      services:\n');
    expect(rendered).toContain('\n        restore:\n');
    expect(rendered).toContain('\n        sunkenland:\n');
    expect(rendered).toContain('\n            - "27015:27015/udp"');
  });

  // Two more block scalars, same syntax and same cost, that nothing was
  // checking: the scripts. A line landing short closes its block, and what
  // follows becomes cloud-init keys nobody wrote — on a billed machine whose
  // only symptom is silence.
  it('lays both scripts inside their block scalars, every line at its own depth', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    // Every line of the filter, since it is exported and can be walked.
    for (const line of SERVERID_FILTER.split('\n').filter((line) => line !== '')) {
      expect(rendered).toContain(`\n      ${line}\n`);
    }
    // The entry point is not exported, so its edges and its deepest line stand
    // for it: shebang, argument list, trap, and the line it ends on.
    expect(rendered).toContain('    content: |\n      #!/usr/bin/env bash\n      set -euo pipefail\n');
    // An argument, at the depth arguments sit at. It used to be
    // `-adminSteamIDs`, which no longer belongs to a fixture — the test that
    // renders one administrator now pins that line at this very depth.
    expect(rendered).toContain('\n        -region eu\n');
    expect(rendered).toContain('\n      trap _terminate HUP INT QUIT TERM\n');
    expect(rendered).toContain('\n      wait\n');
  });

  // Nothing to point at: discovery goes through Photon and transport through
  // direct UDP that NAT traverses. A port one does not call costs less than a
  // port made optional (§4).
  it('announces no hostname, so nothing points a dns record at it', () => {
    expect(catalogFor('sunkenland').hostname).toBeNull();
  });
});

describe('joinInfo', () => {
  const world = { name: "Beacon's World", guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b' };

  it('publie le point de jonction avec le nom que la machine a lu', () => {
    const info = sunkenland.joinInfo({
      address: '51.15.42.7',
      serverId: `${world.guid}~2026-09-14T20-00-00Z`,
      world,
    });
    expect(info).toEqual({
      game: 'sunkenland',
      serverId: `${world.guid}~2026-09-14T20-00-00Z`,
      region: 'eu',
      worldName: "Beacon's World",
    });
  });

  // La defense n'a pas disparu : elle compare desormais les deux valeurs du
  // rapport entre elles. Ce qu'elle attrape ici est un compagnon bogue, pas une
  // vm malveillante — celle-la est arretee plus tot, sur le disque.
  it('refuse un identifiant qui ne nomme pas le monde annonce', () => {
    expect(
      sunkenland.joinInfo({ address: '51.15.42.7', serverId: '00000000-0000-0000-0000-000000000000~x', world }),
    ).toBeNull();
  });

  it('refuse quand aucun monde n est annonce', () => {
    expect(sunkenland.joinInfo({ address: '51.15.42.7', serverId: `${world.guid}~x` })).toBeNull();
  });

  it('refuse quand aucun identifiant n est annonce', () => {
    expect(sunkenland.joinInfo({ address: '51.15.42.7', world })).toBeNull();
  });
});

describe('le script de demarrage', () => {
  it('ne compile plus aucun guid', () => {
    expect(sunkenland.compose()).not.toMatch(/4db51c84/);
    expect(sunkenland.render(REQUEST)).not.toMatch(/4db51c84/);
  });

  // La ligne 208 imprimait un avertissement et lançait le serveur : c'est le
  // chemin vers le monde vierge que le §8 existe pour fermer.
  it('sort non nul quand aucun monde n a ete restaure', () => {
    const script = sunkenland.render(REQUEST);
    expect(script).toMatch(/exit 1/);
  });
});

describe('worldLayoutRefusal', () => {
  it('accepte un monde a la racine', () => {
    expect(
      sunkenland.worldLayoutRefusal([
        "Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~0.json",
        "Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~1.json",
      ]),
    ).toBeNull();
  });

  // Le piege mesure, et celui qui coute un monde : le serveur ne refuse pas
  // cette archive, il genere un monde vierge par-dessus.
  it('refuse une archive construite depuis le dossier parent', () => {
    const refusal = sunkenland.worldLayoutRefusal([
      "Worlds/Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~0.json",
    ]);
    expect(refusal).toMatch(/Worlds/);
  });

  // Characters/ porte exactement la meme forme <nom>~<GUID>. Sans le
  // World~*.json, on adopte un personnage en croyant adopter un monde.
  it('refuse un dossier de personnages, qui a la meme forme', () => {
    const refusal = sunkenland.worldLayoutRefusal([
      'Charlouze~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/Character~0.json',
    ]);
    expect(refusal).toMatch(/World~/);
  });

  it('refuse deux mondes, faute de savoir lequel adopter', () => {
    const refusal = sunkenland.worldLayoutRefusal([
      'A~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~0.json',
      'B~5eb62c95-35df-56af-af9f-99c4d8b4cd4c/World~0.json',
    ]);
    expect(refusal).toMatch(/2|deux|two/i);
  });

  // Le §8 dit « exactement un dossier <nom>~<GUID> a la racine » : le dossier
  // de personnages en est un deuxieme, et le point d'entree compte des
  // dossiers, pas des mondes. L'accepter ici, c'est adopter une archive sur
  // laquelle aucune session ne demarrera jamais.
  it('refuse un dossier de personnages a cote du monde, que la machine compterait', () => {
    const refusal = sunkenland.worldLayoutRefusal([
      "Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b/World~0.json",
      'Charlouze~5eb62c95-35df-56af-af9f-99c4d8b4cd4c/Character~0.json',
    ]);
    expect(refusal).toMatch(/Charlouze~5eb62c95-35df-56af-af9f-99c4d8b4cd4c/);
  });

  it('refuse une archive vide', () => {
    expect(sunkenland.worldLayoutRefusal([])).not.toBeNull();
  });

  it('refuse un guid qui n en est pas un', () => {
    expect(sunkenland.worldLayoutRefusal(['A~pas-un-guid/World~0.json'])).not.toBeNull();
  });
});

/**
 * Le compagnon ne peut pas dependre de ce catalogue en retour (scope:catalog
 * ne remonte pas vers scope:app), donc cette liste n'a pas d'endroit ou vivre
 * en partage : elle est dupliquee ici et dans
 * `deploy/companion/src/lib/world-identity.spec.ts`, sous
 * `describe('l accord entre le compagnon et le catalogue')`.
 *
 * Quatre lecteurs parsent le meme nom de dossier `<nom>~<GUID>` : ce
 * catalogue (`refuseWorldLayout`, avant que l'archive parte), le point
 * d'entree bash de la machine, le compagnon (`readWorldIdentity`, apres la
 * restauration) et `world-depot`. Une divergence entre catalogue et
 * compagnon est une archive que l'adoption accepte et qu'aucune session ne
 * pourra jamais ouvrir : ce catalogue plus permissif dit oui puis rapporte
 * `failed` un soir, le compagnon plus permissif refuse une archive saine.
 *
 * Si cette liste change, la liste jumelle doit changer avec elle.
 */
describe('l accord entre le compagnon et le catalogue', () => {
  const GUID = '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b';
  const names: readonly [string, boolean][] = [
    [`Beacon's World~${GUID}`, true],
    [`A~B~${GUID}`, true],
    ['Worlds', false],
    ['Mon~monde', false],
    [GUID, false],
  ];

  it.each(names)('%s : le catalogue tranche comme le compagnon', (folder, accepted) => {
    expect(refuseWorldLayout('sunkenland', [`${folder}/World~0.json`]) === null).toBe(accepted);
  });
});
