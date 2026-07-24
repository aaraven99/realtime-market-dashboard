"""Vercel serverless endpoint for the public, credential-free dashboard demo."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import yfinance as yf


def market_snapshot(ticker: str) -> dict[str, object]:
    symbol = ticker.upper()
    bars = yf.Ticker(symbol).history(period="1d", interval="1m", prepost=True)
    if bars.empty:
        raise RuntimeError(f"No current yfinance bars returned for {symbol}")
    records = [
        {
            "time": index.isoformat(),
            "open": float(row.Open),
            "high": float(row.High),
            "low": float(row.Low),
            "close": float(row.Close),
            "volume": int(row.Volume),
        }
        for index, row in bars.tail(200).iterrows()
    ]
    return {
        "ticker": symbol,
        "provider": "yfinance",
        "updated_at": records[-1]["time"],
        "bars": records,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        ticker = parse_qs(urlparse(self.path).query).get("ticker", ["NVDA"])[0]
        try:
            body, status = json.dumps(market_snapshot(ticker)).encode(), 200
        except RuntimeError as error:
            body, status = json.dumps({"error": str(error)}).encode(), 503
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
