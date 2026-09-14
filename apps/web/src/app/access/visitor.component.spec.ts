import { TestBed } from '@angular/core/testing';
import { VisitorComponent } from './visitor.component';

describe('VisitorComponent', () => {
  const render = async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(VisitorComponent);
    fixture.componentRef.setInput('name', 'Alex Durand');
    await fixture.whenStable();
    return fixture;
  };

  it('says the one true thing: signed in, and not on the list', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('not on the list');
    expect(text).toContain('Alex Durand');
  });

  it('says what to do about it, which is to ask a person', async () => {
    expect((await render()).nativeElement.textContent.toLowerCase()).toContain('ask whoever');
  });

  it('leaks nothing: no state, no address, no cost', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toMatch(/€|\d+\.\d+\.\d+\.\d+/);
    for (const label of ['Out of service', 'In service', 'How to join', 'This session']) {
      expect(text).not.toContain(label);
    }
  });

  it('offers only the way out', async () => {
    const buttons = [...(await render()).nativeElement.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Sign out');
  });
});
