import { describe, expect, it } from 'vitest';
import type { Game } from '@beacon/session';
import { type BootRequest, renderCloudInit } from './catalog.js';
import { REQUEST } from './catalogue-fixtures.spec-helper.js';

/**
 * Every field of a request that lands in a file docker compose reads, and how
 * a `$` is planted in it. Two fields are absent, and this list is not the whole
 * frontier: `slotCount` because a number cannot carry a `$`, `adminSteamIds`
 * because it lands in no such file at all — it is shell, and the refusal that
 * covers it is stricter and has its own tests below. `endpoint` keeps its
 * `https://` prefix on purpose: without it the other refusal answers first, and
 * the test would pass while proving nothing.
 */
const EXPOSED: readonly (readonly [string, (value: string) => BootRequest])[] = [
  ['serverName', (value) => ({ ...REQUEST, serverName: value })],
  ['serverPassword', (value) => ({ ...REQUEST, serverPassword: value })],
  ['sessionId', (value) => ({ ...REQUEST, sessionId: value })],
  ['agentToken', (value) => ({ ...REQUEST, agentToken: value })],
  ['endpoint', (value) => ({ ...REQUEST, endpoint: `https://control.example/${value}` })],
  ['saves.endpoint', (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, endpoint: value } })],
  ['saves.region', (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, region: value } })],
  ['saves.accessKey', (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, accessKey: value } })],
  ['saves.secretKey', (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, secretKey: value } })],
  [
    'saves.savesBucket',
    (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, savesBucket: value } }),
  ],
  [
    'saves.gamesBucket',
    (value) => ({ ...REQUEST, saves: { ...REQUEST.saves, gamesBucket: value } }),
  ],
];

const GAMES: readonly Game[] = ['enshrouded', 'sunkenland'];

describe('the frontier every boot crosses', () => {
  for (const game of GAMES) {
    // Measured (probe/RESULTS.md, « Un `$` dans le mot de passe ne survit pas
    // à `docker compose` ») : compose reads `$bc` as an empty variable, so
    // `a$bc` arrives as `a` — a warning about an unknown variable, none about
    // the value it just amputated. `env_file` changes nothing, so this covers
    // the game's own `.env` and the companion's alike.
    //
    // Held for both games and not for one: they share a single password
    // secret, so a rule one entry carries lets the other boot on an amputated
    // password, on a server that looks healthy.
    it(`refuses every exposed value carrying a "$", for ${game}`, () => {
      for (const [field, requestWith] of EXPOSED) {
        expect(() => renderCloudInit(game, requestWith('a$bc'))).toThrow(field);
      }
    });

    // Over-refusal costs a session too: `$` is the one character refused, and
    // everything else a human types must still reach a machine.
    it(`renders a request whose values hold no "$", for ${game}`, () => {
      expect(renderCloudInit(game, REQUEST).startsWith('#cloud-config\n')).toBe(true);
    });

    // The one field of a request that reaches a machine as shell, unquoted,
    // inside an `args=( … )`. It travelled from a browser: a member writes it
    // on its own document. Double quotes would buy nothing — bash substitutes
    // inside them — so anything but digits is refused, and refused here rather
    // than in the entry that writes the option, because the request is common
    // to both games and only one of them carries that option today.
    it(`refuses an administrator that is not a steam id, for ${game}`, () => {
      for (const value of ['$(id)', '`id`', '765;rm -rf /', '765 -password x', '']) {
        expect(() =>
          renderCloudInit(game, { ...REQUEST, adminSteamIds: [value] }),
        ).toThrow('adminSteamIds');
      }
    });

    // The index, so a register holding a dozen members names the one to fix.
    it(`refuses a bad administrator hiding behind good ones, for ${game}`, () => {
      expect(() =>
        renderCloudInit(game, {
          ...REQUEST,
          adminSteamIds: ['76561197965918116', '$(id)'],
        }),
      ).toThrow('adminSteamIds[1]');
    });
  }

  // This error travels: `provisioning` summarises it into a field every
  // member's browser reads live, through a sanitiser that only collapses what
  // is long — a short human-chosen password crosses it untouched. So the
  // refusal names the field, and nothing of what it held.
  it('names the field it refuses and never the value', () => {
    let message = '';
    try {
      renderCloudInit('enshrouded', { ...REQUEST, serverPassword: 'hunter$2' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('serverPassword');
    expect(message).not.toContain('hunter');
  });
});
