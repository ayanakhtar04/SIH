import { describe, it, expect } from 'vitest';
import { deriveRiskTierFor } from '../src/util/risk';

describe('deriveRiskTierFor', () => {
  const cases: Array<{ score: number | null | undefined; expected: string }> = [
    { score: null, expected: 'unknown' },
    { score: undefined, expected: 'unknown' },
    { score: 0, expected: 'low' },
    { score: 0.39, expected: 'low' },
    { score: 0.4, expected: 'medium' },
    { score: 0.69, expected: 'medium' },
    { score: 0.7, expected: 'high' },
    { score: 0.95, expected: 'high' }
  ];
  cases.forEach(c => {
    it(`score ${c.score} -> ${c.expected}`, () => {
      expect(deriveRiskTierFor(c.score as any)).toBe(c.expected);
    });
  });
});
