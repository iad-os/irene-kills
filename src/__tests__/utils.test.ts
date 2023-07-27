import { describe, it, vi, expect } from 'vitest';
describe('Utils tests', function () {
  describe('wait', () => {
    it('should wait value for a given amount of time', async () => {
      vi.useFakeTimers();
      const start = Date.now();

      const w = wait(1000, 'Hello');
      vi.advanceTimersByTime(1001);
      const end = Date.now();
      await expect(w).resolves.toBe('Hello');
      expect(end - start).toBeGreaterThanOrEqual(1000);
    });
    it('should wait function for a given amount of time', async () => {
      vi.useFakeTimers();
      const start = Date.now();

      const w = wait(1000, () => 'Hello');
      vi.advanceTimersByTime(1001);
      const end = Date.now();
      await expect(w).resolves.toBe('Hello');
      expect(end - start).toBeGreaterThanOrEqual(1000);
    });
  });
});

function wait<R>(ms: number, value: () => R): Promise<R>;
function wait<R>(ms: number, value: R): Promise<R>;
function wait<R>(ms: number, value: R): Promise<R> {
  return new Promise((resolve) =>
    setTimeout(() => {
      console.log('Promise resolve', value);
      if (typeof value === 'function') resolve(value());
      else resolve(value);
    }, ms),
  );
}

export { wait };
