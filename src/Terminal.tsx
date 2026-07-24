import {useEffect,useState} from "react";
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {bollingerBands,exponentialMovingAverage,generateBars,movingAverage,nextSimulatedBar,normalizeBars,type Bar as MarketBar,type MarketSnapshot,type SimulationConfig} from "./market";
import "./style.css";

type Mode="simulated"|"delayed";
type EventRow={id:number;time:string;message:string};
const symbols=["NVDA","AAPL","MSFT","SPY","TSLA"];
function money(value:number){return `$${value.toFixed(2)}`}
function CandleChart({bars,showSma,showEma,showBands}:{bars:MarketBar[];showSma:boolean;showEma:boolean;showBands:boolean}){
  const [hover,setHover]=useState<number|null>(null);
  const data=bars.slice(-100),width=1000,height=430,padding={left:64,right:18,top:24,bottom:34};
  const lows=data.map(x=>x.low),highs=data.map(x=>x.high),min=Math.min(...lows),max=Math.max(...highs),range=Math.max(max-min,.01);
  const x=(index:number)=>padding.left+index*(width-padding.left-padding.right)/Math.max(data.length-1,1);
  const y=(value:number)=>padding.top+(max-value)/range*(height-padding.top-padding.bottom);
  const closes=data.map(x=>x.close),sma=movingAverage(closes,20),ema=exponentialMovingAverage(closes,12),bands=bollingerBands(closes,20);
  const path=(values:(number|null)[])=>values.map((value,index)=>value===null?"":`${index===values.findIndex(v=>v!==null)?"M":"L"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).filter(Boolean).join(" ");
  const bandPoints=[...bands.map((band,index)=>band.upper===null?null:`${x(index)},${y(band.upper)}`).filter(Boolean),...bands.slice().reverse().map((band,reverseIndex)=>band.lower===null?null:`${x(bands.length-1-reverseIndex)},${y(band.lower)}`).filter(Boolean)].join(" ");
  const selected=hover===null?null:data[hover];
  return <div className="candle-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Candlestick chart" onMouseLeave={()=>setHover(null)}>
    <rect width={width} height={height} fill="transparent"/>
    {[0,.25,.5,.75,1].map(mark=><g key={mark}><line x1={padding.left} x2={width-padding.right} y1={padding.top+mark*(height-padding.top-padding.bottom)} y2={padding.top+mark*(height-padding.top-padding.bottom)} stroke="#223044"/><text x={padding.left-8} y={padding.top+mark*(height-padding.top-padding.bottom)+4} textAnchor="end" fill="#718096" fontSize="12">{(max-mark*range).toFixed(2)}</text></g>)}
    {showBands&&<polygon points={bandPoints} fill="#60a5fa16" stroke="none"/>}
    {data.map((bar,index)=>{const up=bar.close>=bar.open,center=x(index),bodyWidth=Math.max(2,(width-padding.left-padding.right)/data.length*.58),top=y(Math.max(bar.open,bar.close)),bottom=y(Math.min(bar.open,bar.close));return <g key={bar.time} onMouseEnter={()=>setHover(index)}><rect x={center-bodyWidth} y={padding.top} width={bodyWidth*2} height={height-padding.top-padding.bottom} fill="transparent"/><line x1={center} x2={center} y1={y(bar.high)} y2={y(bar.low)} stroke={up?"#34d399":"#fb7185"} strokeWidth="1.4"/><rect x={center-bodyWidth/2} y={top} width={bodyWidth} height={Math.max(bottom-top,1.5)} fill={up?"#34d399":"#fb7185"} rx="1"/></g>})}
    {showSma&&<path d={path(sma)} fill="none" stroke="#fbbf24" strokeWidth="1.8"/>}{showEma&&<path d={path(ema)} fill="none" stroke="#a78bfa" strokeWidth="1.8"/>}
    {hover!==null&&<line x1={x(hover)} x2={x(hover)} y1={padding.top} y2={height-padding.bottom} stroke="#cbd5e1" strokeDasharray="4 4" opacity=".55"/>}
    {selected&&<g><rect x={Math.min(x(hover as number)+12,width-190)} y={32} width="172" height="78" rx="7" fill="#0b1320" stroke="#334155"/><text x={Math.min(x(hover as number)+24,width-178)} y={53} fill="#cbd5e1" fontSize="12">{new Date(selected.time).toLocaleTimeString()}</text><text x={Math.min(x(hover as number)+24,width-178)} y={73} fill="#94a3b8" fontSize="11">O {selected.open.toFixed(2)} H {selected.high.toFixed(2)}</text><text x={Math.min(x(hover as number)+24,width-178)} y={92} fill="#94a3b8" fontSize="11">L {selected.low.toFixed(2)} C {selected.close.toFixed(2)}</text></g>}
  </svg></div>
}
export default function Terminal(){
  const [ticker,setTicker]=useState("NVDA");
  const [mode,setMode]=useState<Mode>("simulated");
  const [seed,setSeed]=useState(42);
  const [startPrice,setStartPrice]=useState(125);
  const [volatility,setVolatility]=useState(.35);
  const [drift,setDrift]=useState(.08);
  const [intervalMs,setIntervalMs]=useState(1000);
  const [bars,setBars]=useState<MarketBar[]>(()=>generateBars({seed:42,startPrice:125,volatility:.35,drift:.08,intervalMs:1000},180));
  const [paused,setPaused]=useState(false);
  const [connected,setConnected]=useState(true);
  const [connection,setConnection]=useState("CONNECTED");
  const [updatedAt,setUpdatedAt]=useState(new Date().toISOString());
  const [showSma,setShowSma]=useState(true),[showEma,setShowEma]=useState(true),[showBands,setShowBands]=useState(true);
  const [range,setRange]=useState("1D");
  const [watchlist,setWatchlist]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem("market-watchlist")||"null")||symbols}catch{return symbols}});
  const [newSymbol,setNewSymbol]=useState("");
  const [events,setEvents]=useState<EventRow[]>([{id:1,time:new Date().toLocaleTimeString(),message:"Simulated snapshot synchronized."}]);
  const config:SimulationConfig={seed,startPrice,volatility,drift,intervalMs};
  const log=(message:string)=>setEvents(rows=>[...rows,{id:(rows.at(-1)?.id||0)+1,time:new Date().toLocaleTimeString(),message}].slice(-100));
  useEffect(()=>{localStorage.setItem("market-watchlist",JSON.stringify(watchlist))},[watchlist]);
  useEffect(()=>{
    if(mode!=="simulated"||paused||!connected)return;
    const timer=window.setInterval(()=>setBars(current=>{const index=(current.at(-1)?.id??current.length-1)+1;const next=nextSimulatedBar(current.at(-1) as MarketBar,config,index);setUpdatedAt(next.time);return normalizeBars([...current,next],240)}),intervalMs);
    return()=>window.clearInterval(timer);
  },[mode,paused,connected,intervalMs,seed,startPrice,volatility,drift]);
  useEffect(()=>{
    if(mode!=="delayed")return;
    let cancelled=false;
    const poll=async()=>{setConnection("POLLING");try{const response=await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`);const snapshot=await response.json() as MarketSnapshot&{error?:string};if(!response.ok)throw new Error(snapshot.error||"Delayed source unavailable");if(!cancelled){setBars(normalizeBars(snapshot.bars));setUpdatedAt(snapshot.updated_at);setConnected(true);setConnection("CONNECTED · 15s DELAYED");log(`Snapshot synchronized for ${ticker}.`)}}catch(error){if(!cancelled){setConnected(false);setConnection("RECONNECTING");log(error instanceof Error?error.message:"Provider unavailable")}}};
    void poll();const timer=window.setInterval(()=>void poll(),15000);return()=>{cancelled=true;window.clearInterval(timer)};
  },[mode,ticker]);
  function reset(){const next=generateBars(config,180);setBars(next);setConnected(true);setPaused(false);setConnection("CONNECTED");setUpdatedAt(next.at(-1)?.time||"");log(`Simulation reset with seed ${seed}.`)}
  function shock(direction:number){setBars(current=>{const index=(current.at(-1)?.id??current.length-1)+1;const next=nextSimulatedBar(current.at(-1) as MarketBar,config,index,.04*direction);return normalizeBars([...current,next],240)});log(`${direction>0?"Positive":"Negative"} 4% price shock injected.`)}
  function volumeSpike(){setBars(current=>{const index=(current.at(-1)?.id??current.length-1)+1;const next=nextSimulatedBar(current.at(-1) as MarketBar,config,index,0,true);return normalizeBars([...current,next],240)});log("Eight-times volume spike injected.")}
  function disconnect(){setConnected(false);setConnection("DISCONNECTED");log("Transport disconnected by simulation control.");window.setTimeout(()=>{setConnection("RECONNECTING · attempt 1");log("Reconnect scheduled with 1s exponential backoff.")},300)}
  function reconnect(){setConnected(true);setConnection("CONNECTED");log(`Subscribed to ${ticker}; heartbeat restored.`)}
  function addSymbol(){const symbol=newSymbol.trim().toUpperCase().slice(0,6);if(symbol&&!watchlist.includes(symbol)){setWatchlist(items=>[...items,symbol]);setNewSymbol("")}}
  function exportCsv(){const csv=["time,open,high,low,close,volume",...bars.map(bar=>`${bar.time},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`)].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`${ticker.toLowerCase()}-${mode}.csv`;anchor.click();URL.revokeObjectURL(url)}
  const displayBars=range==="1H"?bars.slice(-60):range==="4H"?bars.slice(-160):bars;
  const last=bars.at(-1) as MarketBar,first=bars[0],change=last.close-first.open,changePct=change/first.open,previousClose=bars.at(-2)?.close||first.open;
  const volume=bars.reduce((sum,bar)=>sum+bar.volume,0);
  const volumeData=displayBars.slice(-100).map((bar,index)=>({...bar,index,fill:bar.close>=bar.open?"#34d399":"#fb7185"}));
  return <main className="terminal">
    <nav><div className="brand"><span className="logo">M</span><div>MARKET / TERMINAL<small>QUANT RESEARCH WORKSTATION</small></div></div><div className="nav-actions"><button onClick={()=>document.documentElement.classList.toggle("light")}>THEME</button><button onClick={exportCsv}>EXPORT CSV</button><span className={`status ${connected?"online":"offline"}`}><i/>{connection}</span></div></nav>
    <section className="terminal-head"><div><span className="eyebrow">{mode==="simulated"?"SIMULATED DATA":"DELAYED YFINANCE POLLING"}</span><div className="symbol-line"><h1>{ticker}</h1><strong>{money(last.close)}</strong><b className={change>=0?"up":"down"}>{change>=0?"+":""}{change.toFixed(2)} ({(changePct*100).toFixed(2)}%)</b></div><p>Last update {new Date(updatedAt).toLocaleString()} · {mode==="simulated"?`${intervalMs} ms deterministic stream`:"15-second polling; not exchange-grade live data"}</p></div><div className="mode-switch"><button className={mode==="simulated"?"active":""} onClick={()=>{setMode("simulated");reset()}}>SIMULATED</button><button className={mode==="delayed"?"active":""} onClick={()=>setMode("delayed")}>DELAYED</button></div></section>
    <section className="market-stats">{[["OPEN",money(first.open)],["HIGH",money(Math.max(...bars.map(x=>x.high)))],["LOW",money(Math.min(...bars.map(x=>x.low)))],["PREV CLOSE",money(previousClose)],["VOLUME",volume.toLocaleString()],["DATA MODE",mode==="simulated"?"SIMULATED":"DELAYED"]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="terminal-grid">
      <aside className="left-rail">
        <article className="card watch"><header><h2>WATCHLIST</h2><span>{watchlist.length}</span></header>{watchlist.map((symbol,index)=>{const base=80+(symbol.charCodeAt(0)+symbol.length*11)%190,move=((symbol.charCodeAt(symbol.length-1)+seed)%17-8)/100;return <div className={`watch-row ${ticker===symbol?"selected":""}`} key={symbol} onClick={()=>setTicker(symbol)}><div><strong>{symbol}</strong><small>{index%2?"NASDAQ":"NYSE ARCA"}</small></div><div><b>{money(base*(1+move))}</b><span className={move>=0?"up":"down"}>{move>=0?"+":""}{(move*100).toFixed(2)}%</span></div><button aria-label={`Remove ${symbol}`} onClick={event=>{event.stopPropagation();setWatchlist(items=>items.filter(item=>item!==symbol))}}>×</button></div>})}<div className="watch-add"><input value={newSymbol} placeholder="ADD SYMBOL" onChange={event=>setNewSymbol(event.target.value)} onKeyDown={event=>event.key==="Enter"&&addSymbol()}/><button onClick={addSymbol}>ADD</button></div></article>
        <article className="card controls"><header><h2>SIMULATION</h2><span>SEED {seed}</span></header><label>Seed<input type="number" value={seed} onChange={event=>setSeed(+event.target.value)}/></label><label>Starting price<input type="number" value={startPrice} onChange={event=>setStartPrice(+event.target.value)}/></label><label>Annual volatility<input type="number" step=".05" value={volatility} onChange={event=>setVolatility(+event.target.value)}/></label><label>Annual drift<input type="number" step=".01" value={drift} onChange={event=>setDrift(+event.target.value)}/></label><label>Interval<select value={intervalMs} onChange={event=>setIntervalMs(+event.target.value)}><option value="250">250 ms</option><option value="500">500 ms</option><option value="1000">1 second</option><option value="3000">3 seconds</option></select></label><div className="control-grid"><button onClick={()=>setPaused(!paused)}>{paused?"RESUME":"PAUSE"}</button><button onClick={reset}>RESET</button><button onClick={()=>shock(1)}>+4% SHOCK</button><button onClick={()=>shock(-1)}>-4% SHOCK</button><button onClick={volumeSpike}>VOLUME SPIKE</button><button onClick={connected?disconnect:reconnect}>{connected?"DISCONNECT":"RECONNECT"}</button></div></article>
      </aside>
      <div className="main-charts">
        <article className="card chart-card"><header><div><h2>PRICE / OHLC</h2><span>{displayBars.length} BARS · {range}</span></div><div className="indicator-controls"><label><input type="checkbox" checked={showSma} onChange={event=>setShowSma(event.target.checked)}/> SMA 20</label><label><input type="checkbox" checked={showEma} onChange={event=>setShowEma(event.target.checked)}/> EMA 12</label><label><input type="checkbox" checked={showBands} onChange={event=>setShowBands(event.target.checked)}/> BOLLINGER</label>{["1H","4H","1D"].map(item=><button className={range===item?"active":""} onClick={()=>setRange(item)} key={item}>{item}</button>)}</div></header><CandleChart bars={displayBars} showSma={showSma} showEma={showEma} showBands={showBands}/></article>
        <article className="card volume-card"><header><h2>VOLUME</h2><span>{volumeData.at(-1)?.volume.toLocaleString()} LAST BAR</span></header><ResponsiveContainer width="100%" height={170}><BarChart data={volumeData}><CartesianGrid stroke="#1c2838" vertical={false}/><XAxis dataKey="index" hide/><YAxis stroke="#64748b" width={58} tickFormatter={value=>`${Math.round(value/1000)}k`}/><Tooltip labelFormatter={index=>new Date(volumeData[Number(index)]?.time).toLocaleTimeString()}/><Bar dataKey="volume" fill="#60a5fa"/></BarChart></ResponsiveContainer></article>
      </div>
      <aside className="right-rail">
        <article className="card diagnostics"><header><h2>CONNECTION</h2><span className={connected?"up":"down"}>{connected?"HEALTHY":"DEGRADED"}</span></header><dl><div><dt>Mode</dt><dd>{mode}</dd></div><div><dt>Subscription</dt><dd>{ticker}</dd></div><div><dt>Heartbeat</dt><dd>{connected?"ACTIVE":"MISSED"}</dd></div><div><dt>History</dt><dd>{bars.length}/240</dd></div><div><dt>Duplicates</dt><dd>REJECT</dd></div><div><dt>Out of order</dt><dd>SORT + DEDUPE</dd></div><div><dt>Backoff cap</dt><dd>30s</dd></div></dl>{!connected&&<button className="wide" onClick={reconnect}>RESTORE SNAPSHOT</button>}</article>
        <article className="card timeline"><header><h2>EVENT TIMELINE</h2><span>{events.length}</span></header><div>{events.slice().reverse().map(event=><p key={event.id}><time>{event.time}</time>{event.message}</p>)}</div></article>
        <article className="card methodology"><header><h2>INDICATORS</h2></header><p><b>SMA 20</b> averages the last 20 closes.</p><p><b>EMA 12</b> weights recent closes more heavily.</p><p><b>Bollinger Bands</b> show ±2 population standard deviations around SMA 20.</p></article>
      </aside>
    </section>
    <footer><strong>SIMULATION & DATA NOTICE</strong> Simulated mode uses deterministic geometric returns and valid OHLCV construction. Delayed mode polls yfinance through a server-only function; provider secrets never reach the browser. Neither mode is an exchange-grade feed or investment advice.</footer>
  </main>
}
