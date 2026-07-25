import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { movingAverage, normalizeBars, type Bar as MarketBar, type MarketSnapshot } from "./market";
import "./style.css";

export default function App() {
  const [ticker, setTicker] = useState("NVDA");
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting to local yfinance relay…");
  const [updatedAt, setUpdatedAt] = useState("");
  useEffect(() => {
    if (!ticker) return;
    if (window.location.hostname !== "localhost") {
      let cancelled = false;
      const poll = async () => {
        try {
          const response = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`);
          const snapshot = await response.json() as MarketSnapshot & { error?: string };
          if (!response.ok) throw new Error(snapshot.error || "Market API unavailable");
          if (!cancelled) {
            setBars(normalizeBars(snapshot.bars));
            setUpdatedAt(snapshot.updated_at);
            setConnected(true);
            setStatus("Live yfinance data - hosted polling every 15 seconds");
          }
        } catch (error) {
          if (!cancelled) {
            setConnected(false);
            setStatus(error instanceof Error ? error.message : "Market API unavailable");
          }
        }
      };
      void poll();
      const id = window.setInterval(() => void poll(), 15000);
      return () => { cancelled = true; window.clearInterval(id); };
    }
    const source = new EventSource(`http://localhost:8000/api/stream/${ticker}`);
    source.onopen = () => { setConnected(true); setStatus("Live yfinance data · updates every 15 seconds"); };
    source.onmessage = (event) => { const snapshot = JSON.parse(event.data) as MarketSnapshot; setBars(normalizeBars(snapshot.bars)); setUpdatedAt(snapshot.updated_at); };
    source.onerror = () => { setConnected(false); setStatus("Relay unavailable — start npm run backend, then reconnect."); source.close(); };
    return () => source.close();
  }, [ticker]);
  const data = useMemo(() => bars.map((bar, index) => ({ ...bar, ma: movingAverage(bars.map((entry) => entry.close), 10)[index] })), [bars]);
  const last = bars.at(-1);
  if (!last) return <main><header><div><p>MARKET PULSE <em>REAL DATA ONLY</em></p><h1>{ticker}</h1></div><label>Symbol <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12))}/></label><button onClick={() => window.location.reload()}>RECONNECT</button></header><p className="note">{status} No generated fallback is enabled.</p></main>;
  const change = last.close - bars[0].open;
  return <main><header><div><p>MARKET PULSE <em>REAL YFINANCE</em></p><h1>{ticker}</h1></div><label>Symbol <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12))}/></label><button onClick={() => window.location.reload()}>{connected ? "CONNECTED" : "RECONNECT"}</button></header><section className="stats"><article><span>LAST</span><strong>${last.close.toFixed(2)}</strong></article><article><span>SESSION CHANGE</span><strong className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}</strong></article><article><span>HIGH / LOW</span><strong>${Math.max(...bars.map((bar) => bar.high)).toFixed(2)} / ${Math.min(...bars.map((bar) => bar.low)).toFixed(2)}</strong></article></section><section className="chart"><h2>Price & 10-period average</h2><ResponsiveContainer width="100%" height={360}><LineChart data={data}><CartesianGrid stroke="#283342"/><XAxis dataKey="time" hide/><YAxis domain={["dataMin - 2", "dataMax + 2"]}/><Tooltip/><Line dataKey="close" stroke="#72e3a6" dot={false}/><Line dataKey="ma" stroke="#8ba3ff" dot={false}/></LineChart></ResponsiveContainer></section><section className="chart"><h2>Observed volume</h2><ResponsiveContainer width="100%" height={180}><BarChart data={data}><XAxis dataKey="time" hide/><YAxis/><Tooltip/><Bar dataKey="volume" fill="#8ba3ff"/></BarChart></ResponsiveContainer></section><p className="note">{status} Last provider timestamp: {updatedAt || "pending"}. No simulated, cached, or generated fallback is used. yfinance may be delayed and is not an exchange-grade feed.</p></main>;
}
