# GoalAI — World Cup 2026 Predictor

A statistical football predictor for the 2026 World Cup. It forecasts the most
likely scoreline for any matchup using a Poisson goals model, simulates the full
48-team tournament 10,000 times via Monte Carlo to estimate title odds, and
grades its own predictions against real results using the Brier score.

**Live demo:** https://goal-ai-score-predictor-26.vercel.app/

## Features
- **Predictor** — Poisson-distribution scoreline forecasts with win/draw/loss
  probabilities and the full score matrix.
- **Tournament** — 10,000-run Monte Carlo simulation for qualification and
  championship odds, plus a single-run sandbox mode.
- **History** — prediction log with Brier-score accuracy tracking that
  auto-resolves against real match results.
- **Explorer** — head-to-head records and World Cup championship history.

## How the model works
Each match is modeled as two independent Poisson processes over expected goals,
derived from team attack/defense ratings. The score-probability matrix gives the
most likely scoreline and outcome probabilities. The tournament simulator samples
random scorelines from this distribution and repeats the full bracket 10,000 times,
reporting probabilities rather than a single result.

## Tech stack
React · TypeScript · Vite · Tailwind CSS

## Run locally
```bash
npm install
npm run dev
```

## Limitations
Team ratings are approximated from public FIFA rankings, not trained on historical
match data — predictions are directional, not precise. Built as a learning project.

---
*Not affiliated with, endorsed by, or connected to FIFA. For entertainment only —
not betting advice.*
