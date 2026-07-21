# Real-Time Market Dashboard

![Generated market-dashboard demonstration](assets/portfolio-preview.png)

A React + TypeScript dashboard served by a local yfinance relay. The browser never receives provider credentials.

```bash
npm install
npm run backend
```

In a second terminal:

```bash
npm run dev
npm run lint && npm test && npm run build
```

Open the Vite URL after both processes are running. The dashboard requests current one-minute yfinance bars and updates its stream every 15 seconds. It reads `../.env` only on the local backend when present; a cloned copy can use its own ignored `.env`. yfinance is a polling source, not an exchange-grade tick feed.

This project is intended for educational and research purposes only. It does not provide investment advice, and its outputs should not be used as the sole basis for financial decisions. Historical performance and simulated results do not guarantee future performance.

MIT License. Author: Aarav Shah.
