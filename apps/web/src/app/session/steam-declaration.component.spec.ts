import { TestBed } from '@angular/core/testing';
import { SteamDeclarationComponent } from './steam-declaration.component';

describe('SteamDeclarationComponent', () => {
  const render = async (steamId: string | null) => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(SteamDeclarationComponent);
    fixture.componentRef.setInput('steamId', steamId);
    await fixture.whenStable();
    return fixture;
  };

  describe('before it is declared', () => {
    it('asks for it as a band, and says what it buys', async () => {
      const fixture = await render(null);
      expect(fixture.nativeElement.querySelector('[data-field="steam-band"]')).not.toBeNull();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Steam account');
      expect(text.toLowerCase()).toContain('save the world from inside the game');
    });

    /** The one red is the seconds and the warnings. A field to fill is neither. */
    it('asks in ink, never in the signalling red', async () => {
      const fixture = await render(null);
      expect(
        fixture.nativeElement.querySelector('[data-field="steam-band"][data-warn]'),
      ).toBeNull();
    });

    it('offers a field and a way to send it', async () => {
      const fixture = await render(null);
      expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-action="declare"]')).not.toBeNull();
    });

    it('emits what was typed, and validates nothing itself', async () => {
      const fixture = await render(null);
      const declared = vi.fn();
      fixture.componentInstance.declared.subscribe(declared);
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
      input.value = '76561198000000000';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      fixture.nativeElement.querySelector('[data-action="declare"]').click();
      expect(declared).toHaveBeenCalledWith('76561198000000000');
    });

    it('sends nothing while the field is empty', async () => {
      const fixture = await render(null);
      const declared = vi.fn();
      fixture.componentInstance.declared.subscribe(declared);
      fixture.nativeElement.querySelector('[data-action="declare"]').click();
      expect(declared).not.toHaveBeenCalled();
    });
  });

  describe('once it is declared', () => {
    it('shows the value itself, and not a bare "change"', async () => {
      const fixture = await render('76561198000000000');
      expect(fixture.nativeElement.textContent).toContain('76561198000000000');
    });

    it('stops asking: the band gives way to a quiet control', async () => {
      const fixture = await render('76561198000000000');
      expect(fixture.nativeElement.querySelector('[data-field="steam-band"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('input')).toBeNull();
    });

    /** A typo costs the in-game role silently (§5), so it has to be correctable. */
    it('reopens the field on demand, prefilled with what is recorded', async () => {
      const fixture = await render('76561198000000000');
      fixture.nativeElement.querySelector('[data-action="change"]').click();
      await fixture.whenStable();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
      expect(input.value).toBe('76561198000000000');
    });

    it('aligns the digits, a seventeen-figure number being read by eye', async () => {
      const fixture = await render('76561198000000000');
      const value = fixture.nativeElement.querySelector('[data-field="steam-id"]');
      expect(getComputedStyle(value).fontVariantNumeric).toContain('tabular-nums');
    });
  });
});
