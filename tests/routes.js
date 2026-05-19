/**
 * Canonical 14-route list for accessibility + visual regression audits.
 * Sourced from scripts/reality-check-screenshots.js so audit coverage stays
 * in sync with screenshot reality-check coverage.
 */
module.exports = [
  { name: 'home',         path: '/' },
  { name: 'game',         path: '/game' },
  { name: 'settings',     path: '/settings' },
  { name: 'leaderboard',  path: '/leaderboard' },
  { name: 'profile',      path: '/profile' },
  { name: 'play',         path: '/play' },
  { name: 'friends',      path: '/friends' },
  { name: 'cups',         path: '/cups' },
  { name: 'shop',         path: '/shop' },
  { name: 'chip-store',   path: '/chip-store' },
  { name: 'host',         path: '/lobby/host' },
  { name: 'join',         path: '/lobby/join' },
  { name: 'rank',         path: '/rank' },
  { name: 'hand-history', path: '/hand-history' },
];
