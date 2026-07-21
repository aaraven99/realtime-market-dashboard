import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { movingAverage, type Bar as MarketBar, type MarketSnapshot } from "./market";
import "./style.css";

function Candle({ payload, x, y, width, height }: { payload?: MarketBar; x?: number; y?: number; width?: number; height?: number }) {
  if (!payload || x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const up = payload.close >= payload.open;
  return <g><line x1={x + width / 2} x2={x + width / 2} y1={y - 8} y2={y + height + 8} stroke={up ? "#72e3a6" : "#ff7676"}/><rect x={x + 2} y={y} width={Math.max(width - 4, 1)} height={Math.max(height, 1)} fill={up ? "#72e3a6" : "#ff7676"}/></g>;
}

export default function App() {
  const [ticker, setTicker] = useState("NVDA");
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting to local yfinance relay…");
  const [updatedAt, setUpdatedAt] = useState("");
  useEffect(() => {
    if (!ticker) return;
    const source = new EventSource(`http://localhost:8000/api/stream/${ticker}`);
    source.onopen = () => { setConnected(true); setStatus("Live yfinance data · updates every 15 seconds"); };
    source.onmessage = (event) => { const snapshot = JSON.parse(event.data) as MarketSnapshot; setBars(snapshot.bars); setUpdatedAt(snapshot.updated_at); };
    source.onerror = () => { setConnected(false); setStatus("Relay unavailable — start npm run backend, then reconnect."); source.close(); };
    return () => source.close();
  }, [ticker]);
  const data = useMemo(() => bars.map((bar, index) => ({ ...bar, ma: movingAverage(bars.map((entry) => entry.close), 10)[index] })), [bars]);
  const last = bars.at(-1);
  if (!last) return <main><header><div><p>MARKET PULSE <em>LIVE DATA</em></p><h1>{ticker}</h1></div><label>Symbol <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().slice(0, 5))}/></label><button onClick={() => window.location.reload()}>RECONNECT</button></header><p className="note">{status}</p></main>;
  const change = last.close - bars[0].open;
  return <main><header><div><p>MARKET PULSE <em>LIVE YFINANCE</em></p><h1>{ticker}</h1></div><label>Symbol <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().slice(0, 5))}/></label><button onClick={() => window.location.reload()}>{connected ? "CONNECTED" : "RECONNECT"}</button></header><section className="stats"><article><span>LAST</span><strong>${last.close.toFixed(2)}</strong></article><article><span>SESSION CHANGE</span><strong className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}</strong></article><article><span>HIGH / LOW</span><strong>${Math.max(...bars.map((bar) => bar.high)).toFixed(2)} / ${Math.min(...bars.map((bar) => bar.low)).toFixed(2)}</strong></article></section><section className="chart"><h2>Price & 10-period average</h2><ResponsiveContainer width="100%" height={360}><LineChart data={data}><CartesianGrid stroke="#283342"/><XAxis dataKey="time" hide/><YAxis domain={["dataMin - 2", "dataMax + 2"]}/><Tooltip/><Line dataKey="close" stroke="#72e3a6" dot={false}/><Line dataKey="ma" stroke="#8ba3ff" dot={false}/></LineChart></ResponsiveContainer></section><section className="chart"><h2>Volume</h2><ResponsiveContainer width="100%" height={180}><BarChart data={data}><XAxis dataKey="time" hide/><YAxis/><Tooltip/><Bar dataKey="volume" fill="#8ba3ff" shape={<Candle />}/></BarChart></ResponsiveContainer></section><p className="note">{status} Last provider timestamp: {updatedAt || "pending"}. yfinance is a polling source, not an exchange-grade tick feed.</p></main>;
}
