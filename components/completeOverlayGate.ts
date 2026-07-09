// PRACTICE-CHIP-GATE-SWEEP 2026-07-09 — extracted from CompleteOverlay.tsx so it's
// unit-testable: this project's jest config (ts-jest, testEnvironment 'node', a minimal
// react-native mock) has no JSX/component-rendering support, only .ts logic files.
export function shouldShowCompleteBonus(isPractice: boolean | undefined): boolean {
  return !isPractice;
}
