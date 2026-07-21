import assert from "node:assert/strict";
import test from "node:test";
import { appendUnique, generateBars, movingAverage } from "../src/market";

test("mock bars are deterministic and valid", () => {
  const bars = generateBars(3, 3);
  assert.deepEqual(bars, generateBars(3, 3));
  assert.ok(bars.every((bar) => bar.low <= Math.min(bar.open, bar.close) && bar.high >= Math.max(bar.open, bar.close)));
});

test("moving averages and duplicate protection work", () => {
  assert.deepEqual(movingAverage([1, 2, 3], 2), [null, 1.5, 2.5]);
  const first = generateBars(4, 1)[0];
  assert.equal(appendUnique([first], { ...first, close: 99 }).length, 1);
});
