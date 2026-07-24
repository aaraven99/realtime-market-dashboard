import assert from "node:assert/strict";
import test from "node:test";
import {bollingerBands,exponentialMovingAverage,generateBars,movingAverage,nextSimulatedBar,normalizeBars,reconnectDelay,type Bar,type MarketSnapshot} from "../src/market";

test("live snapshot contract accepts normalized provider bars", () => {
  const snapshot: MarketSnapshot = { ticker: "AAPL", provider: "yfinance", updated_at: "2026-07-21T15:00:00Z", bars: [{ time: "2026-07-21T15:00:00Z", open: 200, high: 202, low: 199, close: 201, volume: 1000 }] };
  assert.equal(snapshot.bars[0].low <= Math.min(snapshot.bars[0].open, snapshot.bars[0].close), true);
  assert.equal(snapshot.bars[0].high >= Math.max(snapshot.bars[0].open, snapshot.bars[0].close), true);
});

test("moving averages are calculated client-side", () => {
  assert.deepEqual(movingAverage([1, 2, 3], 2), [null, 1.5, 2.5]);
  assert.deepEqual(exponentialMovingAverage([1,2,3],2).map(value=>value===null?null:Number(value.toFixed(3))),[null,1.667,2.556]);
  assert.equal(bollingerBands([1,2,3],2)[2].middle,2.5);
});

test("seeded candles are valid and reproducible",()=>{
  const config={seed:7,startPrice:100,volatility:.25,drift:.06,intervalMs:1000};
  assert.deepEqual(generateBars(config,5),generateBars(config,5));
  for(const bar of generateBars(config,20)){assert.ok(bar.low<=Math.min(bar.open,bar.close));assert.ok(bar.high>=Math.max(bar.open,bar.close));assert.ok(bar.volume>=0)}
});

test("normalization rejects invalid, duplicate, and out-of-order updates",()=>{
  const good:Bar={time:"2026-01-01T00:02:00Z",open:100,high:102,low:99,close:101,volume:10};
  const older={...good,time:"2026-01-01T00:01:00Z"},duplicate={...good,close:100.5},invalid={...good,time:"2026-01-01T00:03:00Z",low:105};
  const normalized=normalizeBars([good,older,duplicate,invalid],10);
  assert.deepEqual(normalized.map(row=>row.time),[older.time,good.time]);
  assert.equal(normalized[1].close,100.5);
});

test("history is limited and reconnect delay is capped",()=>{
  const bars=generateBars({seed:1,startPrice:100,volatility:.2,drift:.05,intervalMs:1000},20);
  assert.equal(normalizeBars(bars,5).length,5);
  assert.deepEqual([reconnectDelay(1),reconnectDelay(2),reconnectDelay(10)],[1000,2000,30000]);
});

test("shock and volume spike controls affect only requested bar",()=>{
  const config={seed:7,startPrice:100,volatility:.2,drift:.05,intervalMs:1000};
  const first=generateBars(config,2)[1],shock=nextSimulatedBar(generateBars(config,1)[0],config,1,.05,true);
  assert.ok(shock.close>first.close);
  assert.ok(shock.volume>first.volume);
});
