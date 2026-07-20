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
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
  },
};
