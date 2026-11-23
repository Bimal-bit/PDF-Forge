import { describe, expect, it } from 'vitest';
import { boundedPage, boundedZoom, fittedZoom, visiblePage } from './viewGeometry';

describe('view geometry', () => {
  it('fits landscape and portrait crop viewports within available space', () => {
    expect(fittedZoom('page', { width: 600, height: 800 }, { width: 900, height: 440 })).toBe(55);
    expect(fittedZoom('width', { width: 800, height: 600 }, { width: 704, height: 440 })).toBe(88);
    expect(fittedZoom('page', { width: 300, height: 400 }, { width: 1000, height: 1000 })).toBe(250);
    expect(fittedZoom('page', { width: 300, height: 400 }, { width: 0, height: 1000 })).toBeUndefined();
  });
  it('bounds extreme and nonfinite navigation values', () => {
    expect(boundedZoom(NaN, 130)).toBe(130);
    expect(boundedZoom(Infinity, 90)).toBe(90);
    expect(boundedZoom(1000)).toBe(500);
    expect(boundedZoom(-10)).toBe(10);
    expect(boundedPage(9.8, 4)).toBe(4);
    expect(boundedPage(-3, 4)).toBe(1);
    expect(boundedPage(NaN, 4)).toBe(1);
  });
  it('follows the visible page through gaps without preferring its source number', () => {
    const pages = [{ number: 1, top: -700, bottom: -50 }, { number: 2, top: -25, bottom: 625 }, { number: 3, top: 650, bottom: 1300 }];
    expect(visiblePage(pages, 0, 600)).toBe(2);
    expect(visiblePage(pages, 600, 600)).toBe(3);
    expect(visiblePage([], 0, 600)).toBeUndefined();
  });
});
