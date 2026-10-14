import { describe, expect, it } from 'vitest';
import { recordDestinationFrom } from './record-destination.js';

describe('recordDestinationFrom', () => {
  it('names the project when no emulator is set', () => {
    expect(recordDestinationFrom({ BEACON_FIREBASE_PROJECT: 'beacon-x' })).toBe('Firestore of project beacon-x');
  });

  it('treats an empty emulator host as unset', () => {
    expect(recordDestinationFrom({ BEACON_FIREBASE_PROJECT: 'beacon-x', FIRESTORE_EMULATOR_HOST: '' })).toBe(
      'Firestore of project beacon-x',
    );
  });

  it('names the emulator when one is set', () => {
    expect(recordDestinationFrom({ BEACON_FIREBASE_PROJECT: 'beacon-x', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toBe(
      'the Firestore emulator at 127.0.0.1:8080, project beacon-x',
    );
  });
});
