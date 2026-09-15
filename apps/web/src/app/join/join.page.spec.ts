import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JoinPage } from './join.page';

describe('JoinPage', () => {
  const render = async (outcome: 'joining' | 'refused') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(JoinPage);
    fixture.componentRef.setInput('outcome', outcome);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('says it is taking the player in, names no world, and offers nothing to press', async () => {
    const dom = await render('joining');
    const state = dom.querySelector('[data-field="join-outcome"]');
    expect(state?.textContent).toContain('Joining');
    expect(state?.getAttribute('data-tone')).toBe('off');
    expect(dom.textContent).toContain('Taking you in.');
    // The three things the comp makes this page say, and the only things it
    // can say: opening the link makes a player, the board comes next, and
    // leaving is one's own to do.
    expect(dom.textContent).toContain('among the players of a world');
    expect(dom.textContent).toContain('on its board in a moment');
    expect(dom.textContent).toContain('leave it from there');
    expect(dom.querySelector('button, a[href]')).toBeNull();
  });

  it('says the link is not valid, and how to get the one that is', async () => {
    const dom = await render('refused');
    const state = dom.querySelector('[data-field="join-outcome"]');
    expect(state?.textContent).toContain('Link not valid');
    expect(state?.getAttribute('data-tone')).toBe('warn');
    // The rule cannot tell a replaced code from a wrong one, so the screen
    // holds both branches rather than assuming the first.
    expect(dom.textContent).toContain('replaced by a newer one, or it never was right');
    expect(dom.textContent).toContain('Ask whoever plays there');
    expect((dom.querySelector('[data-action="home"]') as HTMLAnchorElement).getAttribute('href')).toBe('/');
  });
});
