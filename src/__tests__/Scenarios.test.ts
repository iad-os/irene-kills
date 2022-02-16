import { IreneKills } from '../IreneKills';
import { wait } from './utils.test';

describe('Irene Kills Common Scenarios', function () {
  afterEach(() => {
    jest.useRealTimers();
  });
  //jest.setTimeout(5000);
  it('Episode 0 - Timeout waking up', async () => {
    jest.useFakeTimers();
    const irene = new IreneKills();
    irene.resource('slooooower', {
      value: { ciao: 'mondo' },
      need: () => wait(10000, { ciao: 'mondo2' }),
    });
    const wakeUp = irene.wakeUp({ timeout: 100 });
    jest.advanceTimersByTime(1000);
    await expect(wakeUp).rejects.toMatch('timeout');
  });
  it('Episode 1 - Sample App with some slow component', async () => {
    const irene = new IreneKills();
    const value = { something: 'slow', active: false };
    irene
      .resource<typeof value>('slow resource', {
        value,
        need: () =>
          wait(100, { something: 'slow resource INIT', active: false }),
        check: ({ value }) => value.something === 'slow resource INIT',
        activate: () => ({ healthy: true, kill: false }),
        healthy: () => ({ healthy: true, kill: false }),
      })
      .resource<typeof value>('slow check resource', {
        value,
        need: () =>
          wait(100, { something: 'slow check resource Need', active: false }),
        check: ({ value }) =>
          wait(100, () => value.something === 'slow check resource Need'),
        activate: () => ({ healthy: true, kill: false }),
        healthy: () => ({ healthy: true, kill: false }),
      })
      .resource<typeof value>('well playing', {
        value,
        need: () => ({ something: 'well playing', active: false }),
        check: ({ value }) => value.something === 'well playing',
        activate: () => ({ healthy: true, kill: false }),
        healthy: () => ({ healthy: true, kill: false }),
        sick: () => ({ healthy: true, kill: false }),
      });

    const wakeUp = irene.wakeUp();

    await expect(wakeUp).resolves.toBeUndefined();
    const hcPromise = irene.healthcheck();
    await expect(hcPromise).resolves.toEqual(
      expect.objectContaining({ healthy: true }),
    );
  });
});


