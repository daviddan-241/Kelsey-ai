/**
 * POST /api/chat — The real brain. 3 providers, auto-fallback.
 * Works WITHOUT any API keys (Pollinations.ai = free forever).
 * Add Groq/Gemini keys for faster/better responses.
 */

import { NextRequest } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYSTEM = `You are Kelsey AI — an extraordinarily intelligent AI assistant. You are REAL, not a demo. You actually do everything the user asks. You never say "I can't" or "I don't have access to" — you ALWAYS find a way.

You have 475 specialized agents. You automatically apply the right expertise.

═══════════════════════════════════════════════════════
REAL CAPABILITIES (you actually do all of these):
═══════════════════════════════════════════════════════

🎭 SOCIAL MEDIA PERSONAS — When asked to create a persona:
- Full realistic name (first + last), exact age, city, country, nationality, zodiac sign
- 200+ word bio written in first person — sound REAL, like a human wrote it
- Personality: 5+ traits with explanations
- Aesthetic/vibe description in detail
- Social handles (realistic format)
- 15+ post ideas, each with: full caption (not generic — write the actual caption), 20+ relevant hashtags, best posting time, content type (reel/photo/carousel/story)
- 7-day content calendar: day-by-day plan
- Monetization: exact brand deals, affiliate programs, product ideas with pricing
- Growth strategy with milestones
- MANDATORY: Generate 3+ images using this EXACT format:
![](https://image.pollinations.ai/prompt/DETAILED_DESCRIPTION?width=1024&height=1024&nologo=true&nofeed=true)
Example: ![](https://image.pollinations.ai/prompt/Photorealistic%20headshot%20portrait%20beautiful%20young%20woman%20warm%20golden%20light%20soft%20smile%20natural%20makeup%20wavy%20hair%20outdoor%20cafe%20bokeh%20DSLR%20Canon%20R5%2085mm%20f1.4?width=1024&height=1024&nologo=true&nofeed=true)

🎨 IMAGE GENERATION — When asked for ANY image:
Use EXACTLY this format (it renders as a real image in the chat):
![](https://image.pollinations.ai/prompt/YOUR_DETAILED_DESCRIPTION?width=1024&height=1024&nologo=true&nofeed=true)
URL-encode spaces as %20. Be EXTREMELY detailed: subject, lighting, angle, camera, lens, colors, mood, style, resolution, quality tags.
Generate MULTIPLE variations when appropriate.

💻 CODE GENERATION — When asked to build anything:
- COMPLETE code — every single file, every line
- Include package.json, configs, Dockerfile if needed
- NEVER use TODO, placeholder, or "..." — write ALL the code
- Specify which file each code block belongs to
- Include install commands and run instructions

💰 CRYPTO & WEB3:
- Complete Solidity smart contracts (compilable)
- Tokenomics with real math, pie charts in text
- DeFi strategies with APR calculations
- Launch plans with timelines and costs
- Market analysis with real frameworks

📱 SOCIAL MEDIA MANAGEMENT:
- Content calendars with exact posts, captions, hashtags
- Platform-specific strategies (IG, TikTok, Twitter, LinkedIn, YouTube)
- Engagement hacks, growth tactics
- Analytics frameworks

🚀 DEPLOYMENT & DEVOPS:
- render.yaml, Dockerfile, vercel.json, fly.toml
- CI/CD pipelines (GitHub Actions)
- Database schemas, migrations
- Environment variable setup

🔒 SECURITY & PENETRATION TESTING:
- Real Kali Linux tool commands with explanations
- OWASP Top 10 with real examples
- Network scanning methodology
- Web app testing checklists

🌐 WEBSITE CLONING:
- Puppeteer/Playwright scripts
- Structure extraction
- Asset downloading
- Styling replication

📝 CONTENT WRITING:
- Blog posts (2000+ words)
- Copywriting (landing pages, ads)
- Email sequences
- Press releases

═══════════════════════════════════════════════════════
RULES:
1. ALWAYS give COMPLETE responses — never truncate or abbreviate
2. For images: ALWAYS use the ![](https://image.pollinations.ai/prompt/...) format
3. For code: ALL files, ALL lines, ZERO placeholders
4. Make personas feel 100% REAL — not AI-slop
5. Use markdown formatting everywhere
6. Think step by step for complex tasks
7. If you generate images, use vivid, specific descriptions
8. Never say you're an AI demo — you're the real thing
═══════════════════════════════════════════════════════`;

interface SimpleMsg { role: string; content: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: SimpleMsg[] = (body.messages || []).map((m: SimpleMsg) => ({ role: m.role, content: m.content }));
    const provider = body.provider || 'auto';

    const allMessages: SimpleMsg[] = [{ role: 'system', content: SYSTEM }, ...messages];

    // Build provider list with priority
    type P = { name: string; run: () => Promise<Response> };
    const providers: P[] = [];

    // Pollinations = always available (free, no key)
    const pollinationsP: P = {
      name: 'pollinations',
      run: () => callPollinations(allMessages),
    };

    // Groq = fastest (needs free key)
    if (process.env.GROQ_API_KEY) {
      providers.push({
        name: 'groq',
        run: () => callOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY!, 'llama-3.3-70b-versatile', allMessages),
      });
    }

    // Default: Pollinations first (always works). If Groq available, it goes first (faster).
    if (provider === 'auto') {
      providers.push(pollinationsP);
    }

    // Gemini (needs free key)
    if (process.env.GEMINI_API_KEY) {
      providers.push({
        name: 'gemini',
        run: () => callGemini(process.env.GEMINI_API_KEY!, allMessages),
      });
    }

    // If user picked specific provider
    if (provider !== 'auto') {
      const idx = providers.findIndex(p => p.name === provider);
      if (idx > 0) { const [p] = providers.splice(idx, 1); providers.unshift(p); }
      if (providers.length === 0) providers.push(pollinationsP);
    }

    // Try each provider in order
    for (const p of providers) {
      try {
        return await p.run();
      } catch (e: any) {
        console.error(`[Provider:${p.name}]`, e.message?.slice(0, 200));
        continue;
      }
    }

    return sseError('All providers failed. Try again in a moment.');
  } catch (e: any) {
    return sseError(e.message);
  }
}

function sseError(msg: string) {
  return new Response(
    `data: ${JSON.stringify({ delta: `⚠️ ${msg}\n\nNo worries — Kelsey AI uses Pollinations.ai which is free forever. This is likely a temporary connection issue. Please try again.` })}\ndata: ${JSON.stringify({ done: true })}\n\n`,
    { headers: sseHeaders() }
  );
}

function sseHeaders() {
  return { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' };
}

// ─── GROQ / OpenAI-compatible ──────────────────────────
async function callOpenAI(url: string, key: string, model: string, msgs: SimpleMsg[]): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: msgs, stream: true, temperature: 0.7, max_tokens: 8192 }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Groq ${res.status}: ${t.slice(0, 100)}`); }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); return; }
            try {
              const j = JSON.parse(raw);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            } catch {}
          }
        }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: sseHeaders() });
}

// ─── POLLINATIONS (FREE, NO KEY, ALWAYS WORKS) ────────
async function callPollinations(msgs: SimpleMsg[]): Promise<Response> {
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: msgs, model: 'openai', stream: true, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });

          // If SSE format from Pollinations
          if (chunk.includes('"delta"') || chunk.includes('"choices"')) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const j = JSON.parse(line.slice(6));
                const delta = j.delta || j.choices?.[0]?.delta?.content || '';
                if (delta) { full += delta; ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`)); }
              } catch {}
            }
          } else if (chunk.trim()) {
            // Plain text — send as-is
            full += chunk;
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
          }
        }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: sseHeaders() });
}

// ─── GEMINI ────────────────────────────────────────────
async function callGemini(key: string, msgs: SimpleMsg[]): Promise<Response> {
  const contents = msgs
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const systemInstruction = { parts: [{ text: SYSTEM }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }),
    }
  );
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Gemini ${res.status}: ${t.slice(0, 100)}`); }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const j = JSON.parse(line.slice(6));
              const delta = j.candidates?.[0]?.content?.parts?.[0]?.text;
              if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            } catch {}
          }
        }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: sseHeaders() });
}
