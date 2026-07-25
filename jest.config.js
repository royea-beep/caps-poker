module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  // Jest collects ONLY *.test.* (and __tests__/). Playwright specs use *.spec.* and are excluded
  // structurally here — never by an ad-hoc CLI flag — so `npx jest` and `npm test` behave the same
  // and a mis-collected Playwright suite can never turn the run permanently red. Playwright still
  // finds its specs via playwright.config.ts (testDir: ./tests/visual).
  testMatch: ['**/__tests__/**/*.(ts|tsx|js)', '**/*.test.(ts|tsx|js)'],
  // Ignore node_modules and the vendored .claude skill packages (their own *.test.js are not CAPS tests).
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
  // GATE HARDENING (2026-07-25): the heavy simulation suites (stressTest ~1500 sims, crash_audit)
  // accumulate heap and used to OOM/V8-crash a full `npx jest`, leaving two suites unrun (a false
  // "green" that hid the real count). The package.json script's `NODE_OPTIONS='...'` POSIX prefix is
  // silently ignored on Windows/cmd.exe, so it never applied there. These jest-config settings work
  // cross-platform: workerIdleMemoryLimit recycles a worker once it grows past the cap, so the heavy
  // suites can't cumulatively exhaust memory, and maxWorkers bounds concurrent heap.
  maxWorkers: '50%',
  workerIdleMemoryLimit: '768MB',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
  },
};
