import { TestBed } from '@angular/core/testing';
import { SignedOutComponent } from './signed-out.component';

describe('SignedOutComponent', () => {
  const render = async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SignedOutComponent);
    await fixture.whenStable();
    return fixture;
  };

  it('says what the product is, in the one sentence that is its positioning', async () => {
    expect((await render()).nativeElement.textContent).toContain('closes itself');
  });

  it('offers one door, and only one', async () => {
    const buttons = [...(await render()).nativeElement.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Sign in with Google');
  });

  /**
   * §5: no session state is readable without membership, so showing one would
   * mean inventing it. Silence here is the correct answer, not an empty state.
   */
  it('shows no session state at all', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-field="state"]')).toBeNull();
    const text: string = fixture.nativeElement.textContent;
    for (const label of ['Out of service', 'In service', 'Preparing', 'Time left']) {
      expect(text).not.toContain(label);
    }
  });

  it('emits rather than signing in itself, the sdk living in a *-record module', async () => {
    const fixture = await render();
    const signIn = vi.fn();
    fixture.componentInstance.signIn.subscribe(signIn);
    fixture.nativeElement.querySelector('button').click();
    expect(signIn).toHaveBeenCalledOnce();
  });
});
