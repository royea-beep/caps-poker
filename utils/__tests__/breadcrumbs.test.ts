/**
 * S93 — Breadcrumbs tests
 */

function loadFresh() {
  jest.resetModules();
  return require('../breadcrumbs');
}

describe('breadcrumbs', () => {
  beforeEach(() => { jest.resetModules(); });

  it('getBreadcrumbs returns empty array initially', () => {
    const { getBreadcrumbs } = loadFresh();
    expect(getBreadcrumbs()).toEqual([]);
  });

  it('addBreadcrumb records screen + timestamp', () => {
    const { addBreadcrumb, getBreadcrumbs } = loadFresh();
    addBreadcrumb('/game');
    const crumbs = getBreadcrumbs();
    expect(crumbs.length).toBe(1);
    expect(crumbs[0].screen).toBe('/game');
    expect(typeof crumbs[0].ts).toBe('string');
  });

  it('addBreadcrumb ignores empty strings', () => {
    const { addBreadcrumb, getBreadcrumbs } = loadFresh();
    addBreadcrumb('');
    expect(getBreadcrumbs()).toHaveLength(0);
  });

  it('ring buffer caps at 20 entries', () => {
    const { addBreadcrumb, getBreadcrumbs } = loadFresh();
    for (let i = 0; i < 25; i++) addBreadcrumb(`/screen-${i}`);
    expect(getBreadcrumbs().length).toBeLessThanOrEqual(20);
  });

  it('getBreadcrumbs returns a copy — mutations do not affect buffer', () => {
    const { addBreadcrumb, getBreadcrumbs } = loadFresh();
    addBreadcrumb('/home');
    const copy = getBreadcrumbs();
    copy.push({ screen: '/injected', ts: '2099' });
    expect(getBreadcrumbs()).toHaveLength(1);
  });

  it('latest breadcrumb is last in array', () => {
    const { addBreadcrumb, getBreadcrumbs } = loadFresh();
    addBreadcrumb('/home');
    addBreadcrumb('/game');
    addBreadcrumb('/results');
    const crumbs = getBreadcrumbs();
    expect(crumbs[crumbs.length - 1].screen).toBe('/results');
  });
});
