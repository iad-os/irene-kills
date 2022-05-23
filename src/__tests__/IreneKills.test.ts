import { IreneKills } from '../IreneKills';
import { wait } from './utils.test';

describe('Irene Kills', function () {
  afterEach(() => {
    jest.useRealTimers();
  });
  describe('Configuration', function () {
    it('Create a new instance of Irene', () => {
      expect(new IreneKills()).toBeInstanceOf(IreneKills);
    });
    it('Create a new instance of Irene passing a logger', () => {
      const logger = {
        error: (body: unknown, msg: string) => {
          console.error(body, msg);
        },
        info: (body: unknown, msg: string) => {
          console.log(body, msg);
        },
      };
      expect(new IreneKills({ logger })).toBeInstanceOf(IreneKills);
    });
    it('Multi istance isolation', () => {
      const failCheck = jest.fn();
      expect.assertions(2);
      const irene1 = new IreneKills();
      const irene2 = new IreneKills();
      irene1.resource('test', {
        healthy: async ({ name }) => {
          expect(name).toBe('test');
          return { kill: false, healthy: true };
        },
      });
      irene2.resource('test', {
        healthy: async () => {
          failCheck();
          return { kill: false, healthy: true };
        },
      });

      return irene1.wakeUp().then(() => {
        // Untill all resources are ready and checked
        expect(failCheck).not.toHaveBeenCalled();
      });
    });
    it('Allow to request a resource', async () => {
      expect.assertions(4);

      const irene = new IreneKills();

      irene.resource('hello', {
        need: async () => {
          return { text: 'hello' };
        },
        check: async ({ value: resource }) => {
          return resource.text && resource.text.length > 0 ? true : false;
        },
        activate: async ({ name, value: resource }) => {
          expect(name).toEqual('hello');
          expect(resource.text).toEqual('hello');
          return { kill: false, healthy: true };
        },
        healthy: async ({ name, value: resource }) => {
          expect(name).toEqual('hello');
          expect(resource.text).toEqual('hello');
          return { kill: false, healthy: true };
        },
        //telemetry: {
        //  state: { counter: 0 },
        //  probe: async (msg, { counter }) => {
        //    return { counter: counter + 1 };
        //  },
        //}
      });

      return await irene.wakeUp(); // Untill all resources are ready and checked

      //expect(irene.resource('hello')).toBe('hello');
    });
    it('Resource fail check', async () => {
      expect.assertions(2);
      const failCheck = jest.fn();
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation(() => undefined);
      irene.resource('hello', {
        value: { text: 'hello' },
        need: () => {
          return new Promise<{ text: string }>((resolve) => {
            setImmediate(() => {
              resolve({ text: 'hello' });
            });
          });
        },
        check: async ({ value: resource }) => {
          return resource.text && resource.text.length > 5 ? true : false;
        },
        activate: async () => {
          failCheck();
          return { kill: false, healthy: true };
        },
      });
      try {
        await irene.wakeUp();
      } catch (e) {
        // console.log(e, 'JEST');
      }
      expect(failCheck).not.toHaveBeenCalled();
      expect(ireneKill).toHaveBeenCalled();
    });
  });
  describe('Multiresources', function () {
    it('One Resource without configs', function () {
      const success = jest.fn();

      const irene = new IreneKills();
      irene.resource('hello', {});
      irene.resource('starter', {
        activate: async () => {
          success();
          return { kill: false, healthy: true };
        },
      });

      return irene.wakeUp().then(() => {
        expect(success).toHaveBeenCalled();
      });
    });
    it('The Initialize phase fails', async () => {
      expect.assertions(2);
      const failCheck = jest.fn();
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });
      irene.resource('hello', {
        value: { text: 'hello' },
        need: () => {
          return new Promise<{ text: string }>((resolve) => {
            resolve({ text: 'hello' });
          });
        },
      });

      irene.resource('loadConfig', {
        need: () => {
          return new Promise<{ loading: string }>((resolve, reject) => {
            reject({ loading: 'fails' });
          });
        },
      });

      irene.resource('starter', {
        healthy: () => {
          failCheck();
          return { kill: false, healthy: true };
        },
      });

      try {
        await irene.wakeUp();
      } catch (e) {
        //console.log(e, 'JEST');
      }
      expect(failCheck).not.toHaveBeenCalled();
      expect(ireneKill).toHaveBeenCalled();
    });

    it('Handle corretcly sync handlers', async () => {
      const irene = new IreneKills();
      irene.resource('sync', {
        need: () => {
          return { text: 'sync' };
        },
        check: () => true,
        activate: () => ({ healthy: true, kill: false }),
        healthy: () => ({ healthy: true, kill: false }),
        sick: () => ({ healthy: false, kill: true }),
        on: {
          healed: () => ({ healed: true, kill: false }),
          healthcheck: () => ({ healthy: true }),
          refresh: () => ({ acknowledged: true }),
          stop: () => true,
        },
      });

      await expect(irene.wakeUp()).resolves.toBeUndefined();
    });
    it('Handle corretcly async handlers', async () => {
      const irene = new IreneKills();
      irene.resource('async', {
        need: async () => {
          return { text: 'async' };
        },
        check: async () => true,
        activate: async () => ({ healthy: true, kill: false }),
        healthy: async () => ({ healthy: true, kill: false }),
        sick: async () => ({ healthy: false, kill: true }),
        on: {
          healed: async () => ({ healed: true, kill: false }),
          healthcheck: async () => ({ healthy: true }),
          refresh: async () => ({ acknowledged: true }),
          stop: async () => true,
        },
      });

      await expect(irene.wakeUp()).resolves.toBeUndefined();
    });
    it('Handle corretctly truly async handlers', async () => {
      const irene = new IreneKills();
      irene.resource('async', {
        need: () => wait(100, { text: 'async' }),
        check: () => wait(100, true),
        activate: () => wait(100, { healthy: true, kill: false }),
        healthy: async () => ({ healthy: true, kill: false }),
        sick: async () => ({ healthy: false, kill: true }),
        on: {
          healed: async () => ({ healed: true, kill: false }),
          healthcheck: async () => ({ healthy: true }),
          refresh: async () => ({ acknowledged: true }),
          stop: async () => true,
        },
      });

      await expect(irene.wakeUp()).resolves.toBeUndefined();
    });

    it('Handle corretcly sync and async handlers', async () => {
      const irene = new IreneKills();
      irene
        .resource('sync', {
          need: () => {
            return { text: 'sync' };
          },
          check: () => true,
          activate: () => ({ healthy: true, kill: false }),
          healthy: () => ({ healthy: true, kill: false }),
          sick: () => ({ healthy: false, kill: true }),
          on: {
            healed: () => ({ healed: true, kill: false }),
            healthcheck: () => ({ healthy: true }),
            refresh: () => ({ acknowledged: true }),
            stop: () => true,
          },
        })
        .resource('async', {
          need: async () => {
            return { text: 'async' };
          },
          check: async () => true,
          activate: async () => ({ healthy: true, kill: false }),
          healthy: async () => ({ healthy: true, kill: false }),
          sick: async () => ({ healthy: false, kill: true }),
          on: {
            healed: async () => ({ healed: true, kill: false }),
            healthcheck: async () => ({ healthy: true }),
            refresh: async () => ({ acknowledged: true }),
            stop: async () => true,
          },
        });

      await expect(irene.wakeUp()).resolves.toBeUndefined();
    });
  });
  describe('healthcheck', () => {
    it('Healthcheck structure OK', async () => {
      const irene = new IreneKills();

      irene.resource('jest_1', {
        value: { test: false, name: '__undef__' },
        need: async ({ name }) => {
          return { test: true, name };
        },
        on: {
          healthcheck: async () => {
            return { healthy: true };
          },
        },
      });
      irene.resource('jest_2', {
        value: { test: false, name: '__undef__' },
        need: async ({ name }) => {
          return { test: true, name };
        },
        on: {
          healthcheck: async () => {
            return { healthy: true };
          },
        },
      });
      await irene.wakeUp();

      const healthReport = await irene.healthcheck();
      expect(healthReport).toEqual(
        expect.objectContaining({
          healthy: true,
          resources: { jest_1: { healthy: true }, jest_2: { healthy: true } },
        }),
      );
    });
    it('Healthcheck structure KO', async () => {
      const irene = new IreneKills();

      irene
        .resource('jest_1', {
          value: { test: false, name: '__undef__' },
          need: async ({ name }) => {
            return { test: true, name };
          },
          on: {
            healthcheck: async () => {
              return { healthy: true };
            },
          },
        })
        .resource('jest_2', {
          value: { test: false, name: '__undef__' },
          need: async ({ name }) => {
            return { test: true, name };
          },
          on: {
            healthcheck: async () => {
              return { healthy: false };
            },
          },
        });
      await irene.wakeUp();

      const healthReport = await irene.healthcheck();
      expect(healthReport).toEqual(
        expect.objectContaining({
          healthy: false,
          resources: { jest_1: { healthy: true }, jest_2: { healthy: false } },
        }),
      );
    });
  });
  describe('Edge cases', () => {
    it('throws if a resource exist with the same name', () => {
      const irene = new IreneKills();
      irene.resource('hello', {});
      expect(() => {
        irene.resource('hello', {});
      }).toThrowError('Resource [hello] already exists');
    });
    it('Irene is already awake', async () => {
      const irene = new IreneKills();
      irene.wakeUp();
      await expect(irene.wakeUp()).resolves.toBeUndefined();
    });
  });
  describe('Sick', () => {
    it('Become sick then IRENE', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });

      const checkMarkFn = jest.fn();
      irene
        .resource('jest_1', {
          on: {
            healthcheck: async () => {
              return { healthy: false };
            },
          },
        })
        .resource('jest_2', {
          sick: async ({ name }) => {
            checkMarkFn({ name });
            return { kill: true };
          },
          on: {
            healthcheck: async () => {
              return { healthy: true };
            },
          },
        });
      await irene.wakeUp();

      expect(checkMarkFn).not.toBeCalled();
      const healthReport = await irene.healthcheck();
      expect(checkMarkFn).toBeCalled();
      expect(healthReport).toEqual(
        expect.objectContaining({
          healthy: false,
          resources: { jest_1: { healthy: false }, jest_2: { healthy: true } },
        }),
      );
      expect(irene.mood()).toEqual('Irene');
      expect(ireneKill).toHaveBeenCalled();
    });
    it('Become sick with hope to healh', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });

      const checkMarkFn = jest.fn();
      irene
        .resource('jest_1', {
          on: {
            healthcheck: async () => {
              return { healthy: false };
            },
          },
        })
        .resource('jest_2', {
          sick: async ({ name }) => {
            checkMarkFn({ name });
            return { kill: false };
          },
        });
      await irene.wakeUp();

      expect(checkMarkFn).not.toBeCalled();
      const healthReport = await irene.healthcheck();
      expect(checkMarkFn).toBeCalled();
      expect(healthReport).toEqual(
        expect.objectContaining({
          healthy: false,
          resources: { jest_1: { healthy: false }, jest_2: { healthy: true } },
        }),
      );
      expect(irene.mood()).toEqual('sick');
      expect(ireneKill).not.toHaveBeenCalled();
    });

    it('some not healthy then sick', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });

      const checkMarkFn = jest.fn();
      irene
        .resource('jest_1', {
          on: {
            healthcheck: async () => {
              return { healthy: false };
            },
          },
        })
        .resource('jest_2', {
          sick: async ({ name }) => {
            checkMarkFn({ name });
            return { kill: false };
          },
          on: {
            healthcheck: async () => {
              return { healthy: false };
            },
          },
        })
        .resource('jest_3', {
          on: {
            healthcheck: async () => {
              return { healthy: true };
            },
          },
        });
      await irene.wakeUp();

      expect(checkMarkFn).not.toBeCalled();
      const healthReport = await irene.healthcheck();
      expect(checkMarkFn).toBeCalled();
      expect(healthReport).toEqual(
        expect.objectContaining({
          healthy: false,
          resources: {
            jest_1: { healthy: false },
            jest_2: { healthy: false },
            jest_3: { healthy: true },
          },
        }),
      );
      expect(irene.mood()).toEqual('sick');
      expect(ireneKill).not.toHaveBeenCalled();
    });
    it('all healthy then NOT sick', async () => {
      const irene = new IreneKills();
      const checkMarkFn = jest.fn();
      irene
        .resource('jest_1', {
          on: {
            healthcheck: async () => {
              return { healthy: true };
            },
          },
        })
        .resource('jest_2', {
          sick: async ({ name }) => {
            checkMarkFn({ name });
            return { kill: true };
          },
          on: {
            healthcheck: async () => {
              return { healthy: true };
            },
          },
        });
      await irene.wakeUp();

      expect(checkMarkFn).not.toBeCalled();
      await irene.healthcheck();
      expect(checkMarkFn).not.toBeCalled();
      expect(irene.mood()).toEqual('healthy');
    });
  });
  describe('FSA state handling', () => {
    it('Empty state', async () => {
      const irene = new IreneKills();
      expect(irene.mood()).toBe(0);
    });
    it('Wake up state', async () => {
      const irene = new IreneKills();
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
    });
    it('Initialize state fail', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });
      irene.resource('fake', {
        need: () => {
          return new Promise<{ text: string }>((resolve, reject) => {
            reject({ loading: 'fails' });
          });
        },
      });
      await irene.wakeUp();
      expect(ireneKill).toHaveBeenCalled();
      expect(irene.mood()).toBe('Irene');
    });
    it('Check state fail', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });
      const checkMark = jest.fn();
      irene.resource('fake', {
        need: () => {
          checkMark();
        },
        check: () => {
          return new Promise((resolve) => {
            resolve(false);
          });
        },
      });
      await irene.wakeUp();
      expect(checkMark).toHaveBeenCalled();
      expect(ireneKill).toHaveBeenCalled();
      expect(irene.mood()).toBe('Irene');
    });

    it('Activate state fail', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });
      const checkMark = jest.fn();
      irene.resource('fake', {
        need: () => {
          checkMark();
        },
        check: () => {
          checkMark();
          return true;
        },
        activate: async () => {
          throw new Error('Activate fails');
        },
      });
      await irene.wakeUp();
      expect(checkMark).toHaveBeenCalledTimes(2);
      expect(ireneKill).toHaveBeenCalled();
      expect(irene.mood()).toBe('Irene');
    });
    it('Healthy state fail', async () => {
      const irene = new IreneKills();
      const ireneKill = jest
        .spyOn(irene, 'kill')
        .mockImplementation((reason) => {
          console.log('🔪 Irene Killed', reason);
        });
      const checkMark = jest.fn();
      irene.resource('fake', {
        need: () => {
          checkMark();
        },
        check: () => {
          checkMark();
          return true;
        },
        activate: async () => {
          checkMark();
          return { healthy: true, kill: false };
        },
        healthy: async () => {
          throw new Error('Healthy fails');
        },
      });
      await irene.wakeUp();
      expect(checkMark).toHaveBeenCalledTimes(3);
      expect(ireneKill).toHaveBeenCalled();
      expect(irene.mood()).toBe('Irene');
    });
  });

  describe('Healthcheck test', () => {
    it('Resource contribute', async () => {
      const irene = new IreneKills();
      irene.resource('a', {
        value: { msg: 'test' },
        on: {
          healthcheck: async ({ name, value: resource }) => {
            return {
              healthy: name === 'a' && resource.msg === 'test',
              msg: `${name} ${resource.msg}`,
            };
          },
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await expect(irene.healthcheck()).resolves.toEqual(
        expect.objectContaining({
          healthy: true,
          resources: { a: { healthy: true, msg: 'a test' } },
        }),
      );
    });
    it('Multiple Resource contribute', async () => {
      const irene = new IreneKills();
      irene
        .resource('a', {
          value: { msg: 'test_a' },
          on: {
            healthcheck: async ({ name, value: resource }) => {
              return {
                healthy: name === 'a' && resource.msg === 'test_a',
                msg: `${name} ${resource.msg}`,
              };
            },
          },
        })
        .resource('b', {
          value: { msg: 'test_b' },
          on: {
            healthcheck: async ({ name, value: resource }) => {
              return {
                healthy: name === 'b' && resource.msg === 'test_b',
                msg: `${name} ${resource.msg}`,
              };
            },
          },
        });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await expect(irene.healthcheck()).resolves.toEqual(
        expect.objectContaining({
          healthy: true,
          resources: {
            a: { healthy: true, msg: 'a test_a' },
            b: { healthy: true, msg: 'b test_b' },
          },
        }),
      );
    });
    it('Multiple with 1 Resource Fail contribute', async () => {
      const irene = new IreneKills();
      irene
        .resource('a', {
          value: { msg: 'test_a' },
          on: {
            healthcheck: async ({ name, value: resource }) => {
              return {
                healthy: name === 'a' && resource.msg === 'test_a',
                msg: `${name} ${resource.msg}`,
              };
            },
          },
        })
        .resource('b', {
          value: { msg: 'test_b' },
          on: {
            healthcheck: async () => {
              return {
                healthy: false,
              };
            },
          },
        });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await expect(irene.healthcheck()).resolves.toEqual(
        expect.objectContaining({
          healthy: false,
          resources: {
            a: { healthy: true, msg: 'a test_a' },
            b: { healthy: false },
          },
          errors: { a: false, b: false },
        }),
      );
    });
    it('Multiple with 1 without contribute', async () => {
      const irene = new IreneKills();
      irene.resource('a', {}).resource('b', {
        on: {
          healthcheck: async () => {
            return {
              healthy: true,
            };
          },
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await expect(irene.healthcheck()).resolves.toEqual(
        expect.objectContaining({
          healthy: true,
          resources: {
            a: { healthy: true },
            b: { healthy: true },
          },
          errors: { a: false, b: false },
        }),
      );
    });
    it('Expect a sick state after healthy = false', async () => {
      const checkCallFn = jest.fn();
      const irene = new IreneKills();
      irene.resource('a', {
        sick: async () => {
          checkCallFn();
          return { kill: false };
        },
        on: {
          healthcheck: async () => {
            return {
              healthy: false,
            };
          },
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await expect(irene.healthcheck()).resolves.toEqual(
        expect.objectContaining({
          healthy: false,
          resources: {
            a: { healthy: false },
          },
        }),
      );
      expect(irene.mood()).toBe('sick');
      expect(checkCallFn).toHaveBeenCalled();
    });
    it('First sick and then healty', async () => {
      const test = { status: 1 };

      const checkHealthy = jest.fn();
      const checkSick = jest.fn();
      const healthcheck = jest.fn();
      const irene = new IreneKills();
      irene.resource('jest1', {
        healthy: async () => {
          checkHealthy();
          return { healthy: true, kill: false };
        },
        sick: async () => {
          checkSick();
          return { kill: false };
        },
        on: {
          healthcheck: async () => {
            healthcheck();
            return test.status
              ? { healthy: false, kill: false }
              : { healthy: true };
          },
        },
      });
      await irene.wakeUp();
      expect(checkHealthy).toHaveBeenCalled();
      await irene.healthcheck();
      expect(checkSick).toHaveBeenCalled();
      expect(healthcheck).toHaveBeenCalled();
      test.status = 0;
      await irene.healthcheck();
      expect(healthcheck).toHaveBeenCalledTimes(2);
      expect(checkHealthy).toHaveBeenCalledTimes(2);

      expect(irene.mood()).toBe('healthy');
    });
    it('First sick and then still sick', async () => {
      const checkHealthy = jest.fn();
      const checkSick = jest.fn();
      const healthcheck = jest.fn();
      const irene = new IreneKills();
      irene.resource('jest1', {
        healthy: async () => {
          checkHealthy();
          return { healthy: true, kill: false };
        },
        sick: async () => {
          checkSick();
          return { kill: false };
        },
        on: {
          healthcheck: async () => {
            healthcheck();
            return { healthy: false, kill: false };
          },
        },
      });
      await irene.wakeUp();
      expect(checkHealthy).toHaveBeenCalled();
      await irene.healthcheck();
      expect(checkSick).toHaveBeenCalled();
      expect(healthcheck).toHaveBeenCalled();
      await irene.healthcheck();
      expect(healthcheck).toHaveBeenCalledTimes(2);

      expect(irene.mood()).toBe('sick');
    });
  });
  describe('Resource value tests', () => {
    it('Value will be available @ need', async () => {
      const irene = new IreneKills();
      const checkValueFn = jest.fn();
      irene.resource('a', {
        value: { msg: 'test' },
        need: async ({ value }) => {
          checkValueFn(value);
          return value;
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      expect(checkValueFn).toHaveBeenCalledWith({ msg: 'test' });
    });
    it('Value will be available @ check', async () => {
      const irene = new IreneKills();
      const checkValueFn = jest.fn();
      irene.resource('a', {
        value: { msg: 'test' },
        check: async ({ value }) => {
          checkValueFn(value);
          return true;
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      expect(checkValueFn).toHaveBeenCalledWith({ msg: 'test' });
    });
    it('Value will be available @ activate', async () => {
      const irene = new IreneKills();
      const checkValueFn = jest.fn();
      irene.resource('a', {
        value: { msg: 'test' },
        activate: async ({ value }) => {
          checkValueFn(value);
          return { healthy: true, kill: false };
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      expect(checkValueFn).toHaveBeenCalledWith({ msg: 'test' });
    });

    it('Value will be available @ healthy', async () => {
      const irene = new IreneKills();
      const checkValueFn = jest.fn();
      irene.resource('a', {
        value: { msg: 'test' },
        healthy: async ({ value }) => {
          checkValueFn(value);
          return { healthy: true, kill: false };
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      expect(checkValueFn).toHaveBeenCalledWith({ msg: 'test' });
    });

    it('Value will be available @ on.healthcheck', async () => {
      const irene = new IreneKills();
      const checkValueFn = jest.fn();
      irene.resource('a', {
        value: { msg: 'test' },
        healthy: async ({ value }) => {
          checkValueFn(value);
          return { healthy: true, kill: false };
        },
        on: {
          healthcheck: async ({ value }) => {
            checkValueFn(value);
            return { healthy: true };
          },
        },
      });
      await irene.wakeUp();
      expect(irene.mood()).toBe('healthy');
      await irene.healthcheck();
      expect(checkValueFn).toHaveBeenNthCalledWith(1, { msg: 'test' });
      expect(checkValueFn).toHaveBeenNthCalledWith(2, { msg: 'test' });
    });
  });
});
