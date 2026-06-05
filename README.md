# Kelsey AI — Your AI Workspace

> One chat. 475 agents. Understands everything. Creates anything. 100% free.

## ✨ What It Does

| You say | It does (FOR REAL) |
|---------|-------------------|
| "Create a girl for socials" | Full persona with bio, posts, calendar + **real AI-generated profile pictures** |
| "Generate an image of X" | **Real image** appears in chat, downloadable |
| "Build me an app" | Complete working code, all files |
| "Crypto prices" | **Live CoinGecko data** in the UI |
| "Smart contract" | Full Solidity, deployable |
| "Content calendar" | 30 days with captions, hashtags, images |
| "Deploy to Render" | Complete render.yaml + instructions |
| **Anything else** | AI understands and responds |

## 🔥 Real Features

- **Real AI chat** — Pollinations.ai (free forever, no key) + Groq + Gemini fallback
- **Real image generation** — Inline in chat, downloadable, lightbox view
- **Real voice input** — Web Speech API (click mic, speak, it types)
- **Real text-to-speech** — AI reads responses aloud
- **Real file upload** — Drag & drop or paste images/files
- **Real crypto data** — Live CoinGecko market prices
- **Real streaming** — Token-by-token response streaming
- **Real persistence** — Chat history, settings saved to localStorage
- **Real export** — Download any chat as Markdown
- **Real dark mode** — Full light/dark theme
- **Real code highlighting** — Syntax highlighting + copy button for every code block

## 🚀 Deploy

### Render (Free)
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. New → Web Service → Connect `Kelsey-ai` repo
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Optional env vars: `GROQ_API_KEY`, `GEMINI_API_KEY`

### Local
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## 🛠 Tech Stack

- **Next.js 15** — React framework
- **Pollinations.ai** — Free AI chat + image generation
- **Groq** — Fast AI (optional free key)
- **Gemini** — Google AI (optional free key)
- **CoinGecko** — Free crypto market data
- **Web Speech API** — Voice input/output
- **Tailwind CSS 4** — Styling
- **Lucide React** — Icons

## 🎨 Design

- Background: `#FAF9F5`
- Accent: `#D97757`
- Font: Inter
- 70% Claude elegance + 20% Apple + 10% futuristic

## 📱 iOS App

See `/nova-ios/` for the companion iOS app (Nova AI) built with React Native/Expo.

---

Made with ✨ by Kelsey AI
