"""Local-only market-data relay. Provider credentials never reach the browser."""

from __future__ import annotations

import json
import time
from pathlib import Path

import yfinance as yf
from dotenv import load_dotenv
from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def _load_environment() -> None:
    root = Path(__file__).resolve().parents[1]
    for candidate in (root / ".env", root.parent / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def market_snapshot(ticker: str) -> dict[str, object]:
    _load_environment()
    bars = yf.Ticker(ticker.upper()).history(period="1d", interval="1m", prepost=True)
    if bars.empty:
        raise RuntimeError(f"No current yfinance bars returned for {ticker.upper()}")
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
        "ticker": ticker.upper(),
        "provider": "yfinance",
        "updated_at": records[-1]["time"],
        "bars": records,
    }


@app.get("/api/market/<ticker>")
def market(ticker: str):
    try:
        return jsonify(market_snapshot(ticker))
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


@app.get("/api/stream/<ticker>")
def stream(ticker: str):
    def events():
        while True:
            try:
                yield f"data: {json.dumps(market_snapshot(ticker))}\n\n"
            except RuntimeError as error:
                yield f"event: error\ndata: {json.dumps({'error': str(error)})}\n\n"
            time.sleep(15)

    return Response(
        events(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache"}
    )


if __name__ == "__main__":
    app.run(port=8000, debug=True, threaded=True)
