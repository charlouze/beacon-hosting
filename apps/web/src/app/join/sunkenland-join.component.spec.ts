import { TestBed } from '@angular/core/testing';
import { SunkenlandJoinComponent } from './sunkenland-join.component';

describe('SunkenlandJoinComponent', () => {
  const info = {
    game: 'sunkenland',
    serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241613967341807',
    region: 'Europe',
    worldName: "Beacon's World",
  } as const;

  const render = async () => {
    const fixture = TestBed.createComponent(SunkenlandJoinComponent);
    fixture.componentRef.setInput('joinInfo', info);
    await fixture.whenStable();
    return fixture;
  };

  it('shows the identifier, the region, and the world name as the fallback', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('4db51c84-24cf-459e-9e9e-88b8c3a7ce3b');
    expect(text).toContain('Europe');
    expect(text).toContain("Beacon's World");
  });

  /**
   * The identifier is a guid and a boot instant joined by a tilde. That is the
   * one place a line break separates two things rather than cutting an
   * identifier in half.
   */
  it('breaks the identifier on the tilde, and nowhere else', async () => {
    const value = (await render()).nativeElement.querySelector('[data-field="server-id"]');
    const segments = [...value.querySelectorAll('[data-seg]')];
    expect(segments).toHaveLength(2);
    expect(value.querySelector('wbr')).not.toBeNull();
    for (const segment of segments) {
      expect(getComputedStyle(segment).whiteSpace).toBe('nowrap');
    }
  });

  it('never shows an address, because this game has none', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(text.toLowerCase()).not.toContain('address');
  });
});
