# AI Day Autopsy

AI Day Autopsy is a demo-first web app that acts like a debugger for bad days. A user pastes a messy day log and gets a structured autopsy with time leaks, burnout signals, root causes, behavior patches, and a saved history of prior analyses.

## Stack

- Frontend: Vanilla HTML, CSS, and JavaScript
- Backend: None for the MVP
- Storage: `localStorage`
- AI integration: Deterministic heuristic analysis engine with structured output, designed to be replaceable with an LLM later

## Why this stack

The workspace started empty, so the MVP uses a zero-dependency architecture to keep the demo stable, fast to run, and easy to present without install friction.

## Features

- Freeform day log input
- Demo mode with sample logs
- Structured autopsy report
- Severity and confidence scoring
- Separate inefficiency and burnout analysis
- Saved history with repeat-pattern detection
- Mobile-friendly polished UI

## Run locally

Open [index.html](/Users/yuktitandon/Desktop/codex%20comp/index.html) directly in a browser, or serve the folder with:

```bash
python3 -m http.server 4173
```
