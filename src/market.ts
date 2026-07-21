export type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number };
export type MarketSnapshot = { ticker: string; provider: string; updated_at: string; bars: Bar[] };
export function movingAverage(values: number[], window: number): Array<number | null> { return values.map((_, i) => i + 1 < window ? null : values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0) / window); }
