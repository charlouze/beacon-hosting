import { TestBed } from '@angular/core/testing';
import type { Viewer } from '@beacon/membership-record/client';
import { FIREBASE_CONNECTION, RELOAD } from './app';
import { CONNECT_MEMBERSHIP, CONNECT_SESSION, Records } from './records';

let sessionRecord: Record<string, ReturnType<typeof vi.fn>>;
let membershipRecord: Record<string, ReturnType<typeof vi.fn>>;
let stopSettings: ReturnType<typeof vi.fn>;
let stopDrift: ReturnType<typeof vi.fn>;
let publishViewer: (viewer: Viewer) => void;
let publishDrift: () => void;

const MEMBER: Viewer = {
  kind: 'member',
  member: { uid: 'u1', name: 'Charlouze', role: 'player', steamId: null },
};

describe('Records', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    stopSettings = vi.fn();
    stopDrift = vi.fn();
    reload = vi.fn();
    sessionRecord = {
      watchSettings: vi.fn(() => stopSettings),
      watchVersionDrift: vi.fn((_compiled: string, onDrift: () => void) => {
        publishDrift = onDrift;
        return stopDrift;
      }),
      extend: vi.fn(async () => undefined),
    };
    membershipRecord = {
      watchViewer: vi.fn((on: (viewer: Viewer) => void) => {
        publishViewer = on;
        return () => undefined;
      }),
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      declareSteamId: vi.fn(async () => undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FIREBASE_CONNECTION, useValue: { app: {} as never } },
        { provide: RELOAD, useValue: reload },
        { provide: CONNECT_MEMBERSHIP, useValue: () => membershipRecord },
        { provide: CONNECT_SESSION, useValue: () => sessionRecord },
      ],
    });
  });

  const records = () => TestBed.inject(Records);

  it('exposes the member, and nobody else, once a membership is published', () => {
    const r = records();
    publishViewer(MEMBER);
    expect(r.member()?.uid).toBe('u1');
    expect(r.visitor()).toBeNull();
    publishViewer({ kind: 'visitor', identity: { uid: 'u2', name: 'Alex' } });
    expect(r.member()).toBeNull();
    expect(r.visitor()).toBe('Alex');
  });

  it('opens the global subscriptions on membership, and drops them the moment it ends', () => {
    records();
    publishViewer(MEMBER);
    expect(sessionRecord['watchSettings']).toHaveBeenCalledOnce();
    expect(sessionRecord['watchVersionDrift']).toHaveBeenCalledOnce();
    publishViewer({ kind: 'signed-out' });
    expect(stopSettings).toHaveBeenCalledOnce();
    expect(stopDrift).toHaveBeenCalledOnce();
  });

  it('opens no second set when the member document changes', () => {
    records();
    publishViewer(MEMBER);
    publishViewer({ ...MEMBER, member: { ...MEMBER.member, steamId: '76561198000000000' } });
    expect(sessionRecord['watchSettings']).toHaveBeenCalledOnce();
  });

  it('reloads the tab on version drift', () => {
    records();
    publishViewer(MEMBER);
    publishDrift();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('hands the session record out only to a member, as an actor with a name', () => {
    const r = records();
    expect(() => r.actor()).toThrow();
    publishViewer(MEMBER);
    expect(r.actor()).toEqual({ uid: 'u1', name: 'Charlouze' });
    expect(r.session()).toBe(sessionRecord);
  });

  it('shows a refused write rather than swallowing it, and says the action failed', async () => {
    const r = records();
    publishViewer(MEMBER);
    expect(await r.run(async () => undefined)).toBe(true);
    expect(r.error()).toBeNull();
    expect(await r.run(async () => Promise.reject(new Error('permission-denied')))).toBe(false);
    expect(r.error()).toContain('permission-denied');
  });
});
