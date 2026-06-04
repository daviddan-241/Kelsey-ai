# Kelsey AI — Premium AI Workspace

> **475 AI agents** × **Free AI** × **Deploy on Render** — zero config needed

## 🚀 Deploy to Render (1 Click)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. It auto-detects `render.yaml`
5. Done! Your app is live.

**Build Command:** `npm install && npm run build`
**Start Command:** `npm start`

## 🆓 Works Without API Keys

Kelsey AI uses **Pollinations.ai** by default — 100% free, no signup, no API key needed.

For **faster, better** responses, add optional free keys:
- **Groq** (free) → [console.groq.com](https://console.groq.com)
- **Gemini** (free) → [aistudio.google.com](https://aistudio.google.com)

## ✨ Features

- 💬 **AI Chat** — Streaming responses, code generation, anything
- 🎨 **Image Generation** — Free via Pollinations.ai
- 📱 **Social Media Tools** — Personas, posts, calendars, hashtags
- 💰 **Crypto Tools** — Live market data, smart contracts, tokenomics
- 🤖 **475 Agents** — 20 categories of specialists
- 🚀 **Deployment** — Help deploying to Render, Vercel, Railway
- 💻 **Code Workspace** — Generate full applications in any language
- ⚙️ **Settings** — Dark mode, API keys, preferences

## 🛠️ Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## 📁 Structure

```
app/
├── page.tsx              Main app (all-in-one)
├── layout.tsx            Root layout
├── globals.css           Design system
├── api/
│   ├── chat/route.ts     AI chat (Groq/Pollinations/Gemini)
│   ├── generate/route.ts Image generation (Pollinations)
│   ├── social/route.ts   Social media tools
│   ├── crypto/route.ts   Crypto & Web3 tools
│   └── tools/route.ts    General AI tools
render.yaml               Render deployment
```

## Free AI Providers Used

| Provider | Use | Key Needed |
|---|---|---|
| Pollinations.ai | Chat + Images | ❌ None |
| Groq | Fast chat | Optional (free) |
| Google Gemini | Multimodal | Optional (free) |
| CoinGecko | Crypto prices | ❌ None |

Built with ❤️ by [daviddan-241](https://github.com/daviddan-241)
