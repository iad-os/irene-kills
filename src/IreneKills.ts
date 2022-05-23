import _ from 'lodash';
import { FSAManager, Signals } from './FSAManager';

interface IreneKill {
  kill: boolean; // Should Kill
}
interface IreneHealthy {
  healthy: boolean; // Should Kill
}

type HealedReply =
  | {
      kill: boolean;
      healed: false;
    }
  | { healed: true; kill: false };

interface IreneEvents<V> {
  healthcheck?: (
    params: {
      value: V;
      name: string;
    },
    defaultHealth: IreneHealthy,
  ) => IreneHealthy | Promise<IreneHealthy>;
  stop?: (params: { value: V; name: string }) => boolean | Promise<boolean>;
  refresh?: (params: { value: V; name: string; signal: Signals }) =>
    | {
        acknowledged: boolean;
      }
    | Promise<{
        acknowledged: boolean;
      }>;

  healed?: (params: {
    value: V;
    health: IreneHealthy;
    name: string;
  }) => HealedReply | Promise<HealedReply>;
}

interface IreneResource<V> {
  value?: V;
  need?: (params: {
    name: string;
    signal: Signals;
    value: V;
  }) => V | Promise<V>;
  check?: (params: {
    value: V;
    name: string;
    signal: Signals;
  }) => boolean | Promise<boolean>;
  activate?: (params: {
    name: string;
    value: V;
    reload: boolean; // Should Reload
    signal: Signals;
  }) => (IreneKill & IreneHealthy) | Promise<IreneKill & IreneHealthy>;
  healthy?: (params: {
    name: string;
    value: V;
    signal: Signals;
  }) => (IreneKill & IreneHealthy) | Promise<IreneKill & IreneHealthy>;
  sick?:
    | ((params: { value: V; name: string }) => IreneKill | Promise<IreneKill>)
    | boolean;
  on?: IreneEvents<V>;
}

export type Logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (body: any, msg: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (body: any, msg: string) => void;
};

export const consoleLoggerDefault: Logger = {
  error: (body, msg) => {
    console.error(body, msg);
  },
  info: (body, msg) => {
    console.log(body, msg);
  },
};

export class IreneKills {
  private resources: Record<string, IreneResource<any>> = {};
  private logger: Logger = consoleLoggerDefault;
  private fsm: InstanceType<typeof FSAManager>;

  constructor(props?: { logger?: Logger }) {
    this.logger = props?.logger ?? consoleLoggerDefault;
    this.fsm = new FSAManager({
      states: {
        initialize: {
          activate: async ({ current, signal }) => {
            const arrayResources = _(this.resources)
              .map((resource, name) => ({ name, resource }))
              .value();

            const promises = _(arrayResources)
              .map(async ({ resource, name }) => {
                if (!resource.need)
                  return await { name, resource, value: resource.value };

                return {
                  name,
                  resource,
                  value: await resource.need({
                    name,
                    signal,
                    value: resource.value,
                  }),
                };
              })
              .value();

            const results = await Promise.allSettled(promises);

            const isRejected = checkIfRejected<Awaited<typeof promises[0]>>(
              results,
              arrayResources,
            );

            if (isRejected.length > 0) {
              const errors = isRejected.map(({ promiseInfo, resource }) => ({
                [resource]:
                  promiseInfo.status === 'rejected' && promiseInfo.reason,
              }));
              return { forwardTo: 'Irene', error: errors };
            }

            if (isRejected.length === 0) {
              results.map((promiseInfo) => {
                if (promiseInfo.status === 'fulfilled') {
                  const { value } = promiseInfo;
                  value.resource.value = value.value;
                }
              });
              return { forwardTo: 'check', results };
            }
          },
        },
        check: {
          activate: async ({ signal }) => {
            const arrayResources = _(this.resources)
              .map((resource, name) => ({ name, resource }))
              .value();

            const promises = _(arrayResources)
              .map(async ({ resource, name }) => {
                if (!resource.check)
                  return await { name, resource, value: true };

                return {
                  name,
                  resource,
                  value: await resource.check({
                    name,
                    value: resource.value,
                    signal,
                  }),
                };
              })
              .value();

            const results = await Promise.allSettled(promises);
            const isRejected = checkIfRejected<Awaited<typeof promises[0]>>(
              results,
              arrayResources,
            );

            if (isRejected.length > 0) {
              const errors = isRejected.map(({ promiseInfo, resource }) => ({
                [resource]:
                  promiseInfo.status === 'rejected' && promiseInfo.reason,
              }));
              return { forwardTo: 'Irene', error: errors };
            }

            if (isRejected.length === 0) {
              const ok = results.reduce(
                (acc, promiseInfo) => {
                  if (promiseInfo.status === 'fulfilled') {
                    const { value } = promiseInfo;
                    return {
                      ...acc,
                      state: acc.state && value.value,
                      resources: [
                        ...acc.resources,
                        { [value.name]: { check: value.value } },
                      ],
                    };
                  }
                  return acc;
                },
                { state: true, resources: [] } as {
                  state: boolean;
                  resources: { [key: string]: { check: boolean } }[];
                },
              );
              return !ok.state
                ? { forwardTo: 'Irene', error: ok.resources }
                : { forwardTo: 'activate' };
            }
          },
        },
        activate: {
          activate: async ({ current, signal }) => {
            const arrayResources = _(this.resources)
              .map((resource, name) => ({ name, resource }))
              .value();

            const promises = _(arrayResources)
              .map(async ({ resource, name }) => {
                if (!resource.activate)
                  return {
                    name,
                    resource,
                    value: {
                      kill: false,
                      healthy: true,
                      reload: false,
                      signal,
                    },
                  };

                return {
                  name,
                  resource,
                  value: await resource.activate({
                    name,
                    value: resource.value,
                    reload: false,
                    signal,
                  }),
                };
              })
              .value();

            const results = await Promise.allSettled(promises);

            const isRejected = checkIfRejected<Awaited<typeof promises[0]>>(
              results,
              arrayResources,
            );

            if (isRejected.length > 0) {
              const errors = isRejected.map(({ promiseInfo, resource }) => ({
                [resource]:
                  promiseInfo.status === 'rejected' && promiseInfo.reason,
              }));
              return { forwardTo: 'Irene', error: errors };
            }

            if (isRejected.length === 0) {
              const status = results.reduce(
                (acc, promiseInfo) => {
                  if (promiseInfo.status === 'fulfilled') {
                    const { value } = promiseInfo;
                    return {
                      state: {
                        kill: acc.state.kill || value.value.kill,
                        healthy:
                          acc.state.healthy && (value.value.healthy ?? true),
                      },
                      resources: {
                        ...acc.resources,
                        [value.name]: {
                          kill: value.value.kill,
                          healthy: value.value.healthy ?? true,
                        },
                      },
                    };
                  }
                  return acc;
                },
                { state: { kill: false, healthy: true }, resources: {} } as {
                  state: IreneKill & IreneHealthy;
                  resources: Record<string, IreneKill & IreneHealthy>;
                },
              );

              if (status.state.kill) {
                return { forwardTo: 'Irene', error: status.resources };
              }
              if (!status.state.healthy) {
                return { forwardTo: 'sick', error: status.resources };
              }
              return { forwardTo: 'healthy' };
            }
          },
        },
        healthy: {
          activate: async ({ current, signal }) => {
            const arrayResources = _(this.resources)
              .map((resource, name) => ({ name, resource }))
              .value();
            const promises = _(arrayResources)
              .map(async ({ resource, name }) => {
                if (!resource.healthy)
                  return {
                    name,
                    resource,
                    value: { kill: false, healthy: true },
                  };

                return {
                  name,
                  resource,
                  value: await resource.healthy({
                    name,
                    value: resource.value,
                    signal,
                  }),
                };
              })
              .value();

            const results = await Promise.allSettled(promises);
            const isRejected = checkIfRejected<Awaited<typeof promises[0]>>(
              results,
              arrayResources,
            );

            if (isRejected.length > 0) {
              const errors = isRejected.map(({ promiseInfo, resource }) => ({
                [resource]:
                  promiseInfo.status === 'rejected' && promiseInfo.reason,
              }));
              return { forwardTo: 'Irene', error: errors };
            }
          },
        },
        sick: {
          activate: async ({ current, signal }) => {
            const arrayResources = _(this.resources)
              .map((resource, name) => ({ name, resource }))
              .value();
            const promises = _(arrayResources)
              .map(async ({ resource, name }) => {
                if (!resource.sick || typeof resource.sick === 'boolean')
                  return await {
                    name,
                    resource,
                    decision: { kill: false },
                  };

                return {
                  name,
                  resource,
                  decision: await resource.sick({
                    name,
                    value: resource.value,
                  }),
                };
              })
              .value();

            const results = await Promise.allSettled(promises);
            const isRejected = checkIfRejected<Awaited<typeof promises[0]>>(
              results,
              arrayResources,
            );

            if (isRejected.length > 0) {
              const errors = isRejected.map(({ promiseInfo, resource }) => ({
                [resource]:
                  promiseInfo.status === 'rejected' && promiseInfo.reason,
              }));
              return { forwardTo: 'Irene', error: errors };
            }
            if (isRejected.length === 0) {
              const killDecision = results.reduce(
                (acc, promiseInfo) => {
                  if (promiseInfo.status === 'fulfilled') {
                    const { name, resource, decision } = promiseInfo.value;
                    acc.kill = acc.kill || decision.kill;
                    if (decision.kill)
                      acc.killers.push({ name, value: resource.value });
                  }

                  return acc;
                },
                {
                  kill: false,
                  killers: [],
                } as {
                  kill: boolean;
                  killers: { name: string; value: unknown }[];
                },
              );
              if (killDecision.kill)
                return { forwardTo: 'Irene', error: killDecision.killers };
            }
          },
        },
        Irene: {
          activate: async ({ current, signal }) => {
            this.kill(signal);
          },
        },
      },
      transitions: {
        wakeup: [
          { current: 0, success: 'initialize', failure: 'Irene' },
          { current: 'initialize', success: 'check', failure: 'Irene' },
          { current: 'check', success: 'activate', failure: 'Irene' },
          { current: 'activate', success: 'healthy', failure: 'Irene' },
          { current: 'activate', success: 'sick', failure: 'Irene' },
          { current: 'healthy', success: 'sick', failure: 'Irene' },
        ],
        refresh: [
          { current: 'healthy', success: 'initialize', failure: 'Irene' },
        ],
        health: [
          { current: 'healthy', success: 'healthy', failure: 'sick' },
          // { current: 'sick', success: 'sick', failure: 'Irene' },
          { current: 'sick', success: 'healthy', failure: 'Irene' },
        ],
        sick: [
          { current: 'healthy', success: 'sick', failure: 'Irene' },
          { current: 'sick', success: 'sick', failure: 'Irene' },
          { current: 'sick', success: 'healthy', failure: 'Irene' },
        ],
        stop: [
          { current: 'healthy', success: 'Irene', failure: 'Irene' },
          { current: 'sick', success: 'Irene', failure: 'Irene' },
        ],
      },
      logger: this.logger,
    });
  }

  kill(reason?: any) {
    setImmediate(() => {
      process.exit(reason === 'stop' ? 0 : 1);
    });
  }

  mood() {
    return this.fsm.state();
  }
  resource<R>(
    name: string,
    resConfig: IreneResource<R>,
    //telemetry?: {
    //  state: T;
    //  probe: (msg: I[N], oldReport: T) => Promise<T>;
    //};
  ): this {
    if (this.resources[name]) {
      throw new Error(`Resource [${name}] already exists`);
    }
    if (resConfig) {
      this.resources[name] = resConfig;
    }
    return this;
  }

  async wakeUp(opt?: { timeout: number | null }): Promise<void> {
    if (this.fsm.state() !== 0) {
      return;
    }
    return timeout(opt?.timeout ?? null, () => this.fsm.signal('wakeup'));
  }
  async healthcheck(opt?: { timeout: number | null }): Promise<{
    healthy: boolean;
    resources: Record<string, IreneHealthy>;
    errors: Record<string, any>;
  }> {
    return timeout(opt?.timeout ?? null, async () => {
      await Promise.race([
        this.fsm.awaitState('healthy'),
        this.fsm.awaitState('sick'),
      ]);

      const healthcheck = await Promise.all(
        _(this.resources)
          .map(async (resource, name) => {
            if (!resource?.on?.healthcheck) {
              return { name, resource, response: undefined };
            }
            try {
              return {
                name,
                resource,
                response: await resource.on.healthcheck(
                  { name, value: resource.value },
                  {} as IreneHealthy,
                ),
              };
            } catch (e) {
              return { name, resource, response: undefined, error: e };
            }
          })
          .value(),
      );
      const summary = healthcheck.reduce(
        (acc, { name, response, error }) => {
          return {
            healthy: acc.healthy && (response?.healthy ?? true),
            resources: {
              ...acc.resources,
              [name]: response ?? { healthy: true },
            },
            errors: { ...acc.errors, [name]: error ?? false },
          };
        },
        { healthy: true, resources: {}, errors: {} } as {
          healthy: boolean;
          resources: Record<string, IreneHealthy>;
          errors: Record<string, any>;
        },
      );

      if (!summary.healthy) {
        await this.fsm.signal('sick');
      } else {
        await this.fsm.signal('health');
      }
      return summary;
    });
  }
}

function timeout<R, T extends () => Promise<R>>(
  ms: number | null,
  fn: T,
): Promise<R> {
  if (!ms) return fn();
  return Promise.race([
    fn(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject('timeout');
      }, ms);
    }) as never,
  ]);
}

function checkIfRejected<T>(
  results: PromiseSettledResult<T>[],
  arrayResources: {
    name: string;
    resource: IreneResource<any>;
  }[],
) {
  return results
    .map((promiseInfo, index) => ({
      promiseInfo,
      resource: arrayResources[index].name,
    }))
    .filter(({ promiseInfo }) => promiseInfo.status === 'rejected');
}
