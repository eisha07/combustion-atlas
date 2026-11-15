# Combustion Atlas: setup and hosting

An AI-assisted dashboard that ranks and explains NASA PSI combustion investigations for fire safety in crew habitats.

```
combustion-atlas/
├── public/                 the website (static files)
│   ├── index.html          layout + styles for both views
│   ├── app.js              all behaviour: 3D map, ranking, charts, pins, tour, AI guide
│   ├── data.js             the 26 PSI records, habitats, weights, roles  ← edit data here
│   ├── config.js           where the AI guide sends questions
│   └── vendor/three.min.js 3D library (three.js r128, MIT licence included)
├── api/ask.js              AI endpoint for Vercel (serverless function)
├── server.js               AI endpoint + static server for any Node host
├── lib/guide.js            shared AI logic: prompt, input checks, rate limit, Anthropic call
├── package.json
├── vercel.json
└── .env.example            the settings the server needs
```

## How the AI guide works when self-hosted

The browser never sees your API key. The page sends the question plus the user's role, habitat and scores to `/api/ask`.
The server builds the guide's instructions from `public/data.js`, calls your chosen AI service with your key (Anthropic by default, or any OpenAI-compatible service), and returns the answer.
If the answer uses a tool (fly to an investigation, pin for comparison, switch habitat), the page runs it and sends the result back, up to 4 rounds.

The endpoint only serves this guide: the server writes the system prompt, accepts only the three dashboard tools, caps message size, and rate-limits each visitor (30 requests per 10 minutes by default).

If the endpoint is missing or fails, the guide falls back to answering from the dashboard's own data, so the site never breaks.

## What you need

1. **An API key** for one AI service. The default is Anthropic (a key from the [Claude Console](https://platform.claude.com), Settings → API keys), but any OpenAI-compatible service works: see "Using a different AI service" below. Set a monthly spend limit wherever you can.
2. **A GitHub account** (to push the code) and **a free Vercel account**, or any host that runs Node 18+.
3. **Node 18 or newer** if you want to run it on your own computer first.

## Option A: Vercel (recommended, free tier, site + AI in one)

1. Push this folder to a new GitHub repository (keep `.env` out; `.gitignore` already does this).
2. In Vercel: **Add New → Project → Import** your repository. Framework preset: **Other**. Leave build command empty. Output directory is set to `public` by `vercel.json`.
3. Under **Settings → Environment Variables**, add `AI_API_KEY` = your key (plus `AI_PROVIDER`, `AI_MODEL` and `AI_BASE_URL` if you use another service). Optional: `ALLOWED_ORIGIN` = your site address (e.g. `https://combustion-atlas.vercel.app`) once you know it.
4. **Deploy.** Open the address Vercel gives you and ask the guide a question to check it.

## Option B: any Node host (Render, Railway, Fly.io, a VPS) or your laptop

```bash
npm install
cp .env.example .env        # then paste your key into .env
npm start                   # → http://localhost:3000
```

On Render or Railway: create a **Web Service** from your repo, build command `npm install`, start command `npm start`, and add `AI_API_KEY` (and the other `AI_` settings if needed) in the service's environment settings. The host sets `PORT` automatically.

## Option C: static only (GitHub Pages, Netlify Drop, any file host), no live AI

1. In `public/config.js` set `aiEndpoint: null`.
2. Upload the contents of `public/` (GitHub Pages: push and choose the `public` folder, or copy its files to the repo root).

Everything works except live AI answers; the guide answers from the dashboard's own data instead.

## Using a different AI service

The page always talks to your own `/api/ask`; only the server changes. Set `AI_PROVIDER=openai` to use any service with an OpenAI-compatible chat API, and the server translates the guide's messages and tool calls for it.

| Service | `AI_PROVIDER` | `AI_BASE_URL` | Key from |
| --- | --- | --- | --- |
| Anthropic (default) | `anthropic` | not needed | Claude Console |
| OpenAI | `openai` | `https://api.openai.com/v1` | OpenAI platform |
| Google Gemini | `openai` | `https://generativelanguage.googleapis.com/v1beta/openai` | Google AI Studio |
| Groq | `openai` | `https://api.groq.com/openai/v1` | Groq console |
| OpenRouter | `openai` | `https://openrouter.ai/api/v1` | OpenRouter |
| Ollama (on your own computer) | `openai` | `http://localhost:11434/v1` | no key; put any text |

Set `AI_MODEL` to a model name from that service's model list, and pick one that supports **tool / function calling** (the guide uses it to fly the map, pin and switch habitat). Smaller free models may answer less accurately or skip the tools; the dashboard still works either way.

## Settings (environment variables)

| Name | Required | Default | What it does |
| --- | --- | --- | --- |
| `AI_API_KEY` | yes | none | Your key for the chosen service; stays on the server (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` also accepted) |
| `AI_PROVIDER` | no | `anthropic` | `anthropic` or `openai` (any OpenAI-compatible service) |
| `AI_MODEL` | for `openai` | `claude-sonnet-5-5` for Anthropic | Model the guide uses |
| `AI_BASE_URL` | for non-OpenAI `openai` services | `https://api.openai.com/v1` | The service's OpenAI-compatible address |
| `MAX_TOKENS` | no | 4000 (Anthropic) / 1200 (others) | Upper limit per reply |
| `RATE_LIMIT_PER_10_MIN` | no | `30` | Questions per visitor per 10 minutes, per server instance |
| `ALLOWED_ORIGIN` | no | none | If set, only requests from this site address are answered |

## Editing the data

All content lives in `public/data.js`. Each investigation is one record; its six ratings (`s: {F, D, S, O, R, M}`, each 0–1) drive the ranking.
A new record appears on the 3D map, in the ranking, the charts and the AI guide's catalog without other changes.

## Notes

- Data: NASA Physical Sciences Informatics, combustion investigation search (read 15 Nov 2026). Descriptions are paraphrased; relevance scores are an editorial weighting.
- Fonts load from Google Fonts; everything else is served from your own host.
- Never put the API key in `public/` or commit `.env`.
