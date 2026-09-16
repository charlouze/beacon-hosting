import { TestBed } from '@angular/core/testing';
import { MAX_WORLD_NAME, World } from '@beacon/session';
import { ORIGIN } from '../records';
import { WorldBandComponent } from './world-band.component';

const world = (game: 'enshrouded' | 'sunkenland' = 'enshrouded') =>
  World.from({
    worldId: 'les-bras-casses',
    game,
    name: 'Les bras cassés',
    inviteCode: '7f3a9c2e',
    players: ['u1', 'u2', 'u3'],
  });

describe('WorldBandComponent', () => {
  const render = async (w = world()) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ORIGIN, useValue: 'https://beacon.charlouze.com' }],
    });
    const fixture = TestBed.createComponent(WorldBandComponent);
    fixture.componentRef.setInput('world', w);
    const renamed = vi.fn();
    const reinvited = vi.fn();
    const left = vi.fn();
    fixture.componentInstance.renamed.subscribe(renamed);
    fixture.componentInstance.reinvited.subscribe(reinvited);
    fixture.componentInstance.left.subscribe(left);
    await fixture.whenStable();
    const dom = fixture.nativeElement as HTMLElement;
    const click = async (action: string) => {
      (dom.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click();
      await fixture.whenStable();
    };
    return { fixture, dom, click, renamed, reinvited, left };
  };

  it('shows the name, the game, the link with its code, and the players counted, not named', async () => {
    const { dom } = await render();
    expect(dom.querySelector('[data-field="world-name"]')?.textContent).toContain('Les bras cassés');
    expect(dom.querySelector('[data-field="world-game"]')?.textContent).toContain('Enshrouded');
    expect(dom.querySelector('[data-field="invite-link"]')?.textContent).toContain(
      'beacon.charlouze.com/join/les-bras-casses/7f3a9c2e',
    );
    expect(dom.querySelector('[data-field="players-count"]')?.textContent).toContain('3');
    expect(dom.textContent).not.toContain('u2');
  });

  it('says the server announces itself under this name for Enshrouded only', async () => {
    expect((await render(world('enshrouded'))).dom.textContent).toContain('announces itself');
    expect((await render(world('sunkenland'))).dom.textContent).not.toContain('announces itself');
  });

  it('hands the copy button the whole link, not what is printed', async () => {
    const { dom } = await render();
    expect(dom.querySelector('[data-copy]')?.getAttribute('data-copy')).toBe(
      'https://beacon.charlouze.com/join/les-bras-casses/7f3a9c2e',
    );
  });

  it('renames in place, and emits the new name on save', async () => {
    const { dom, click, renamed, fixture } = await render();
    await click('rename');
    const field = dom.querySelector('input[data-field="world-name"]') as HTMLInputElement;
    expect(field.value).toBe('Les bras cassés');
    field.value = 'Les bras solides';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await click('save-name');
    expect(renamed).toHaveBeenCalledWith('Les bras solides');
    expect(dom.querySelector('input[data-field="world-name"]')).toBeNull();
  });

  it('refuses an empty or overlong name, and says why in the hint', async () => {
    const { dom, click, renamed, fixture } = await render();
    await click('rename');
    const field = dom.querySelector('input[data-field="world-name"]') as HTMLInputElement;
    field.value = 'x'.repeat(MAX_WORLD_NAME + 1);
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect((dom.querySelector('[data-action="save-name"]') as HTMLButtonElement).disabled).toBe(true);
    expect(dom.querySelector('[data-field="name-hint"]')?.textContent).toContain(`${MAX_WORLD_NAME}`);
    await click('cancel-name');
    expect(renamed).not.toHaveBeenCalled();
    expect(dom.querySelector('[data-field="world-name"]')?.textContent).toContain('Les bras cassés');
  });

  it('asks before making a new link, and emits only on confirmation', async () => {
    const { dom, click, reinvited } = await render();
    await click('new-link');
    expect(dom.querySelector('[data-field="link-hint"]')?.textContent).toContain('Discord');
    expect(reinvited).not.toHaveBeenCalled();
    await click('keep-link');
    expect(reinvited).not.toHaveBeenCalled();
    await click('new-link');
    await click('confirm-new-link');
    expect(reinvited).toHaveBeenCalledOnce();
  });

  it('asks before leaving, says what stays, and emits only on confirmation', async () => {
    const { dom, click, left } = await render();
    await click('leave');
    expect(dom.querySelector('[data-field="leave-hint"]')?.textContent).toContain('saves');
    await click('stay');
    expect(left).not.toHaveBeenCalled();
    await click('leave');
    await click('confirm-leave');
    expect(left).toHaveBeenCalledOnce();
  });

  it('keeps one question open at a time', async () => {
    const { dom, click } = await render();
    await click('new-link');
    await click('leave');
    expect(dom.querySelector('[data-action="confirm-new-link"]')).toBeNull();
    expect(dom.querySelector('[data-action="confirm-leave"]')).not.toBeNull();
  });
});
