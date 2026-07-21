import assert from "node:assert/strict";
import test from "node:test";
import { movingAverage, type MarketSnapshot } from "../src/market";

test("live snapshot contract accepts normalized provider bars", () => {
  const snapshot: MarketSnapshot = { ticker: "AAPL", provider: "yfinance", updated_at: "2026-07-21T15:00:00Z", bars: [{ time: "2026-07-21T15:00:00Z", open: 200, high: 202, low: 199, close: 201, volume: 1000 }] };
  assert.equal(snapshot.bars[0].low <= Math.min(snapshot.bars[0].open, snapshot.bars[0].close), true);
  assert.equal(snapshot.bars[0].high >= Math.max(snapshot.bars[0].open, snapshot.bars[0].close), true);
});

test("moving averages are calculated client-side", () => {
  assert.deepEqual(movingAverage([1, 2, 3], 2), [null, 1.5, 2.5]);
});
