import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emulatorPortsFrom } from './emulator-ports.js';

/** Vitest roots this project at `tools/dev-session`, so the real file is four up. */
const REAL_CONFIG = new URL('../../../../firebase.dev.json', import.meta.url);

const CONFIG = JSON.stringify({
  firestore: { rules: 'firestore.dev.rules', indexes: 'firestore.indexes.json' },
  functions: [{ source: 'apps/functions/dist', codebase: 'default' }],
  emulators: {
    firestore: { port: 8080 },
    functions: { port: 5001 },
    hub: { port: 4400 },
    ui: { enabled: true, port: 4000 },
    singleProjectMode: true,
  },
});

describe('reading the ports the emulator was told to use', () => {
  it('takes the three the command needs', () => {
    expect(emulatorPortsFrom(CONFIG)).toEqual({ functions: 5001, hub: 4400, ui: 4000 });
  });

  // The top-level `functions` key is an array of codebases and has no port.
  // Reading it instead of emulators.functions would yield undefined, and the
  // tunnel would be opened towards `http://127.0.0.1:undefined`.
  it('reads emulators.functions, not the codebase declaration next to it', () => {
    expect(emulatorPortsFrom(CONFIG).functions).toBe(5001);
  });

  it('names the port that is missing rather than falling back to a default', () => {
    const without = JSON.stringify({ emulators: { firestore: { port: 8080 }, hub: { port: 4400 } } });
    expect(() => emulatorPortsFrom(without)).toThrow(/functions/);
  });

  it('refuses a ui that is declared but switched off', () => {
    const off = JSON.stringify({
      emulators: { functions: { port: 5001 }, hub: { port: 4400 }, ui: { enabled: false, port: 4000 } },
    });
    expect(() => emulatorPortsFrom(off)).toThrow(/ui/);
  });
});

/**
 * The one test that fails when someone edits firebase.dev.json without reading
 * this file. It is the whole reason the ports are declared there rather than
 * copied here.
 */
describe('the real firebase.dev.json', () => {
  it('declares all three ports this command depends on', () => {
    const ports = emulatorPortsFrom(readFileSync(REAL_CONFIG, 'utf8'));
    expect(ports).toEqual({ functions: 5001, hub: 4400, ui: 4000 });
  });
});
