# DevVault AI Runtime Runbook

## Local services

```bash
docker compose up -d mongo redis
```

## Environment

Copy examples and fill secrets:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Required for full production behavior:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`
- One AI provider key: `GEMINI_API_KEY` or `OPENAI_API_KEY`

OAuth callback URLs:

- Google: `http://localhost:5001/api/auth/oauth/google/callback`
- GitHub: `http://localhost:5001/api/auth/oauth/github/callback`

Stripe webhook URL:

- `http://localhost:5001/api/subscription/webhook`

## Run app

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Health check:

```bash
curl http://localhost:5001/health
```

Without OAuth/Stripe/AI keys the app still runs for local development, but:

- OAuth buttons redirect back with a configuration error.
- Billing falls back to local plan simulation.
- AI answers use deterministic offline fallback summaries/vectors.
