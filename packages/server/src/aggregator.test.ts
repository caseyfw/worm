import { describe, it, expect } from 'vitest';
import { RollingAggregator } from './aggregator.js';

describe('RollingAggregator', () => {
  it('returns value 0 when window is empty', () => {
    const agg = new RollingAggregator();
    const sample = agg.tick(1000);
    expect(sample.value).toBe(0);
    expect(sample.t).toBe(1000);
  });

  it('returns 1 when all reactions are up', () => {
    const agg = new RollingAggregator({ windowMs: 10_000 });
    agg.record('up', 100);
    agg.record('up', 200);
    agg.record('up', 300);
    const sample = agg.tick(500);
    expect(sample.value).toBe(1);
  });

  it('returns -1 when all reactions are down', () => {
    const agg = new RollingAggregator({ windowMs: 10_000 });
    agg.record('down', 100);
    agg.record('down', 200);
    const sample = agg.tick(500);
    expect(sample.value).toBe(-1);
  });

  it('returns 0 when equal up and down', () => {
    const agg = new RollingAggregator({ windowMs: 10_000 });
    agg.record('up', 100);
    agg.record('down', 200);
    const sample = agg.tick(500);
    expect(sample.value).toBe(0);
  });

  it('returns a fractional mean for unequal counts', () => {
    const agg = new RollingAggregator({ windowMs: 10_000 });
    agg.record('up', 100);
    agg.record('up', 200);
    agg.record('down', 300);
    const sample = agg.tick(500);
    // (1 + 1 + -1) / 3 = 1/3
    expect(sample.value).toBeCloseTo(1 / 3);
  });

  it('excludes events older than windowMs', () => {
    const agg = new RollingAggregator({ windowMs: 5_000 });
    agg.record('down', 1000);
    agg.record('up', 4000);
    // At t=6001, the event at t=1000 is outside the 5s window (cutoff = 1001)
    const sample = agg.tick(6001);
    expect(sample.value).toBe(1); // only the up at 4000 remains
  });

  it('caps history at historySize, dropping oldest first', () => {
    const agg = new RollingAggregator({ windowMs: 10_000, historySize: 3 });
    agg.tick(1000);
    agg.tick(2000);
    agg.tick(3000);
    agg.tick(4000); // should push out the t=1000 sample

    const history = agg.history();
    expect(history).toHaveLength(3);
    expect(history[0]!.t).toBe(2000);
    expect(history[2]!.t).toBe(4000);
  });

  it('history() returns a defensive copy', () => {
    const agg = new RollingAggregator({ windowMs: 10_000, historySize: 5 });
    agg.tick(1000);
    agg.tick(2000);

    const copy = agg.history();
    copy.push({ t: 9999, value: 0.5 });
    copy[0] = { t: 0, value: -1 };

    // Internal state should be unaffected
    const fresh = agg.history();
    expect(fresh).toHaveLength(2);
    expect(fresh[0]!.t).toBe(1000);
  });
});
