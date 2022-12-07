import { EventEmitter } from 'stream';
import { consoleLoggerDefault, Logger } from './IreneKills';

export type Signals = 'wakeup' | 'refresh' | 'health' | 'sick' | 'stop';


type TransitionsType<States extends string> = Record<
  Signals,
  {
    current: States | 0;
    success: States;
    failure: States;
  }[]
>;

export type FMSEvents<States extends string> =
  | States
  | '__new__'
  | `${States}:deactivated`
  | `${States}:activated`
  | ':deactivated'
  | ':activated';

export class FSAManager<States extends string> {
  private transitions: TransitionsType<States>;

  private _state: { current: States | 0 };
  private events = new EventEmitter();
  private states: Record<
    States,
    {
      activate: (params: { current: States | 0; signal: Signals }) => Promise<{
        forwardTo?: States;
        error?: unknown;
      } | void>;
    }
  >;
  private logger: Logger;

  constructor({
    transitions,
    states,
    logger,
  }: {
    states: Record<
      States,
      {
        activate: (params: {
          current: States | 0;
          signal: Signals;
        }) => Promise<{
          forwardTo?: States;
          error?: unknown;
        } | void>;
      }
    >;
    transitions: Record<
      Signals,
      {
        current: States | 0;
        success: States;
        failure: States;
      }[]
    >;
    logger?: Logger
  }) {
    this.logger = logger ?? consoleLoggerDefault;
    this._state = { current: 0 };
    this.transitions = transitions;
    this.states = states;
  }

  state() {
    return this._state.current;
  }
  on(
    event: FMSEvents<States>,
    cb: ({
      current,
      to,
      signal,
    }: {
      current: States | 0;
      to: States;
      signal: Signals;
      activation?: void | {
        forwardTo?: States | undefined;
      };
    }) => void,
  ) {
    this.events.on(event, cb);
  }
  async signal(signal: Signals) {
    const signalTransistions = this.transitions[signal];
    const haveATransition = signalTransistions.find(
      (t) => t.current === this._state.current,
    );
    this.logger.debug(
      { signal, haveATransition, signalTransistions },
      `Signal ${signal}`,
    );
    if (haveATransition) {
      try {
        await this.tryChangeState({
          current: this._state.current,
          to: haveATransition.success,
          signal,
        });
      } catch (e) {
        await this.tryChangeState({
          current: this._state.current,
          to: haveATransition.failure,
          signal,
        });
      }
    }
  }

  async awaitState(state: States | 0) {
    if (this._state.current === state) return;
    return new Promise((resolve) => {
      this.events.once(state === 0 ? '__new__' : state, resolve);
    });
  }
  private async tryChangeState({
    current,
    to,
    signal,
  }: {
    current: States | 0;
    to: States;
    signal: Signals;
  }): Promise<void> {
    this.logger.debug(
      { current, to, signal },
      `${signal} -> Try change state: ${current} -> ${to}`,
    );
    this.isTransitionAllowed({ signal, current, to });
    const activation = await this.states[to].activate({ current, signal });
    if (activation?.error) {
      this.logger.error(
        activation.error,
        `Error in Transition: ${current} -> ${to}`,
      );
    }
    this._state.current = to;
    this.events.emit(to, { current, to, signal });
    if (activation?.forwardTo) {
      await this.tryChangeState({
        current: to,
        to: activation.forwardTo,
        signal,
      });
    }
  }
  private isTransitionAllowed({
    current,
    to,
    signal,
  }: {
    current: States | 0;
    to: States;
    signal: Signals;
  }) {
    if (
      this.transitions[signal].find(
        (t) => t.current === current && (t.success === to || t.failure === to),
      ) === undefined
    )
      throw new Error(`${signal} Transition not allowed: ${current} -> ${to}`);
  }
}
