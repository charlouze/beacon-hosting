import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { WorldSummary } from '@beacon/session-record/client';
import { Records } from '../records';
import { JoinRoute } from './join.route';

const ACTOR = { uid: 'u1', name: 'Charlouze' };

describe('JoinRoute', () => {
  const session = {
    join: vi.fn(async () => undefined),
    watchWorld: vi.fn((_id: string, on: (v: WorldSummary | null) => void) => {
      on(null);
      return () => undefined;
    }),
  };
  const records = { session: () => session, actor: () => ACTOR };

  const mount = async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Records, useValue: records }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(JoinRoute);
    fixture.componentRef.setInput('worldId', 'les-bras-casses');
    fixture.componentRef.setInput('code', '7f3a9c2e');
    await fixture.whenStable();
    return { dom: fixture.nativeElement as HTMLElement, navigate };
  };

  it('joins with the code from the address, then goes to the world', async () => {
    const { navigate } = await mount();
    expect(session.join).toHaveBeenCalledWith('les-bras-casses', '7f3a9c2e', ACTOR);
    expect(navigate).toHaveBeenCalledWith('/worlds/les-bras-casses');
  });

  it('shows the link as not valid when the rule refuses, and stays', async () => {
    session.join.mockRejectedValueOnce(new Error('wrong invite code'));
    const { dom, navigate } = await mount();
    expect(dom.querySelector('[data-field="join-outcome"]')?.textContent).toContain('Link not valid');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reads nothing on its own: the record is the only thing it talks to', async () => {
    await mount();
    expect(session.watchWorld).not.toHaveBeenCalled();
  });
});
