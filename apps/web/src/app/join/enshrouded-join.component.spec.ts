import { TestBed } from '@angular/core/testing';
import { EnshroudedJoinComponent } from './enshrouded-join.component';

describe('EnshroudedJoinComponent', () => {
  const info = {
    game: 'enshrouded',
    hostname: 'enshrouded.beacon.charlouze.com',
    address: '51.159.84.12',
    port: 15637,
  } as const;

  const render = async () => {
    const fixture = TestBed.createComponent(EnshroudedJoinComponent);
    fixture.componentRef.setInput('joinInfo', info);
    await fixture.whenStable();
    return fixture;
  };

  it('shows the main way in, and the fallback beside it', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('enshrouded.beacon.charlouze.com');
    expect(text).toContain('51.159.84.12');
  });

  /** §8: DynHost can fail without the evening being lost, and then the raw ip is the way in. */
  it('names the fallback for what it is, so nobody wonders which to use', async () => {
    expect((await render()).nativeElement.textContent).toContain('Raw ip');
  });

  it('prints the port once, and not inside both values', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text.match(/15637/g)).toHaveLength(1);
  });

  it('reserves the quay blue for the address, which is the only thing it marks', async () => {
    const fixture = await render();
    const address = fixture.nativeElement.querySelector('[data-field="address"]');
    expect(address.textContent).toContain('enshrouded.beacon.charlouze.com');
  });

  it('copies host and port together, which is what gets pasted into the game', async () => {
    const fixture = await render();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')];
    const values = buttons.map((b: HTMLElement) => b.getAttribute('data-copy'));
    expect(values).toContain('enshrouded.beacon.charlouze.com:15637');
    expect(values).toContain('51.159.84.12:15637');
  });
});
