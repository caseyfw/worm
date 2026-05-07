import type { ReactionKind, Sample } from '@worm/shared';

export type Strategy = 'mean' | 'ewma' | 'momentum';

export interface AggregatorOptions {
  /** Aggregation strategy. Default: 'mean' */
  strategy?: Strategy;
  /** Rolling window size in ms (used by 'mean'). Default: 10_000 */
  windowMs?: number;
  /** Max history samples retained. Default: 60 */
  historySize?: number;
  /** EWMA smoothing factor (0–1). Higher = more reactive. Default: 0.15 */
  alpha?: number;
  /** Momentum: how much each reaction nudges the value. Default: 0.1 */
  impulse?: number;
  /** Momentum: friction per tick (multiplied each second). Default: 0.85 */
  friction?: number;
}

interface ReactionEvent {
  value: number;
  ts: number;
}

export class RollingAggregator {
  private readonly strategy: Strategy;
  private readonly windowMs: number;
  private readonly historySize: number;
  private readonly alpha: number;
  private readonly impulse: number;
  private readonly friction: number;

  private readonly events: ReactionEvent[] = [];
  private readonly samples: Sample[] = [];

  // EWMA state
  private ewmaValue = 0;

  // Momentum state
  private momentumValue = 0;
  private velocity = 0;

  constructor(opts: AggregatorOptions = {}) {
    this.strategy = opts.strategy ?? 'mean';
    this.windowMs = opts.windowMs ?? 10_000;
    this.historySize = opts.historySize ?? 60;
    this.alpha = opts.alpha ?? 0.15;
    this.impulse = opts.impulse ?? 0.1;
    this.friction = opts.friction ?? 0.85;
  }

  record(kind: ReactionKind, nowMs: number): void {
    const value = kind === 'up' ? 1 : -1;
    this.events.push({ value, ts: nowMs });

    if (this.strategy === 'ewma') {
      // Each reaction nudges the EWMA toward +1 or -1
      this.ewmaValue = this.ewmaValue + this.alpha * (value - this.ewmaValue);
    } else if (this.strategy === 'momentum') {
      // Each reaction adds impulse to velocity
      this.velocity += this.impulse * value;
    }
  }

  tick(nowMs: number): Sample {
    let value: number;

    switch (this.strategy) {
      case 'mean':
        value = this.tickMean(nowMs);
        break;
      case 'ewma':
        value = this.tickEwma();
        break;
      case 'momentum':
        value = this.tickMomentum();
        break;
    }

    const sample: Sample = { t: nowMs, value };

    // Append to history ring buffer
    this.samples.push(sample);
    if (this.samples.length > this.historySize) {
      this.samples.shift();
    }

    return sample;
  }

  history(): Sample[] {
    return [...this.samples];
  }

  private tickMean(nowMs: number): number {
    // Discard events outside the rolling window
    const cutoff = nowMs - this.windowMs;
    while (this.events.length > 0 && this.events[0]!.ts <= cutoff) {
      this.events.shift();
    }

    if (this.events.length === 0) return 0;

    let sum = 0;
    for (const e of this.events) {
      sum += e.value;
    }
    return sum / this.events.length;
  }

  private tickEwma(): number {
    // Decay toward 0 each tick (so silence = neutral)
    this.ewmaValue *= 1 - this.alpha * 0.3;
    return Math.max(-1, Math.min(1, this.ewmaValue));
  }

  private tickMomentum(): number {
    // Apply velocity, then friction
    this.momentumValue += this.velocity;
    this.velocity *= this.friction;

    // Clamp to [-1, 1]
    this.momentumValue = Math.max(-1, Math.min(1, this.momentumValue));

    // Small drag toward 0 so it eventually settles
    this.momentumValue *= 0.98;

    return this.momentumValue;
  }
}
