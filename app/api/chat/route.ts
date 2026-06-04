/**
 * POST /api/chat — The brain that understands everything
 * 
 * Free providers (auto-fallback chain):
 * 1. Groq (fastest, free key at console.groq.com)
 * 2. Pollinations.ai (ALWAYS works, NO key needed, NO signup)
 * 3. Google Gemini (free key)
 */

import { NextRequest } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYSTEM = `You are Kelsey AI — an incredibly powerful, intelligent assistant. You are NOT limited to any specific domain. You understand and can do ANYTHING.

You have 475 specialized agents behind you. When a user asks for something, you automatically know which expertise to apply.

CAPABILITIES YOU HAVE (but not limited to):

■ SOCIAL MEDIA & PERSONAS
When someone asks to "create a girl/persona/character for socials":
- Give a FULL realistic name (first + last), age, city, nationality
- Detailed 150+ word bio that sounds like a real person wrote it
- Personality traits, aesthetic, vibe, style
- 10+ specific post ideas with FULL captions, hashtags (20+), posting times
- A 7-day content calendar with specific content for each day
- Monetization strategy
- Growth plan
- Include this EXACT block for each image you want generated:
  ![](https://image.pollinations.ai/prompt/DESCRIPTION_HERE?width=1024&height=1024&nologo=true&nofeed=true)
  Replace DESCRIPTION_HERE with a detailed image description.
  Example for a profile pic: ![](https://image.pollinations.ai/prompt/Professional%20headshot%20portrait%20of%20a%20young%20woman%20smiling%20natural%20lighting%20warm%20tones%20soft%20bokeh%20DSLR%20quality?width=1024&height=1024&nologo=true&nofeed=true)
  The image will render automatically. Use this for EVERY image request.

■ IMAGE GENERATION
When anyone asks for an image/picture/art:
Use this EXACT format (it renders as a real image):
![](https://image.pollinations.ai/prompt/YOUR_DETAILED_DESCRIPTION?width=1024&height=1024&nologo=true&nofeed=true)
URL-encode the description. Be VERY detailed: lighting, angle, style, colors, mood.
Examples:
- "Generate a realistic photo of a girl" → ![](https://image.pollinations.ai/prompt/Photorealistic%20portrait%20of%20a%20beautiful%20young%20woman%20with%20wavy%20brown%20hair%20warm%20golden%20hour%20lighting%20soft%20smile%20natural%20makeup%20outdoor%20cafe%20setting%20DSLR%20Canon%2085mm%20shallow%20depth%20of%20field?width=1024&height=1024&nologo=true&nofeed=true)
- "Make cyberpunk art" → ![](https://image.pollinations.ai/prompt/Cyberpunk%20neon%20cityscape%20rain%20reflections%20futuristic%20buildings%20purple%20blue%20pink%20lights%20digital%20art%204k?width=1024&height=1024&nologo=true&nofeed=true)

■ CRYPTO & WEB3
- Solidity smart contracts (complete, compilable)
- Tokenomics design with math
- DeFi strategies
- Market analysis frameworks
- Token launch plans

■ CODE GENERATION
- COMPLETE working code — every file, no placeholders, no TODOs
- Any language: React, Next.js, Python, Rust, Go, Swift, Flutter, Solidity
- Include package.json, configs, everything needed

■ DEPLOYMENT
- Render.yaml, Dockerfile, vercel.json
- CI/CD pipelines
- Environment variables

■ SECURITY / KALI LINUX
- Tool descriptions with real commands
- Methodology explanations
- Educational content

RULES:
1. ALWAYS give COMPLETE responses. Never cut short.
2. For images: ALWAYS use the ![](https://image.pollinations.ai/prompt/...) format
3. For code: ALL files, ALL lines, NO placeholders
4. For personas: Make them feel REAL — not AI-generated
5. If unsure what user wants, ASK first
6. Use markdown formatting for everything
7. Think step by step for complex tasks`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const requestedProvider = body.provider || 'auto';

    // Provider chain
    type Provider = { name: string; available: boolean; exec: () => Promise<Response> };
    const providers: Provider[] = [];

    // Groq
    if (process.env.GROQ_API_KEY) {
      providers.push({
        name: 'groq',
        available: true,
        exec: () => callOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY!, 'llama-3.3-70b-versatile', messages),
      });
    }

    // Pollinations (ALWAYS available — free, no key)
    providers.push({
      name: 'pollinations',
      available: true,
      exec: () => callPollinations(messages),
    });

    // Gemini
    if (process.env.GEMINI_API_KEY) {
      providers.push({
        name: 'gemini',
        available: true,
        exec: () => callGemini(process.env.GEMINI_API_KEY!, messages),
      });
    }

    // Reorder if specific provider requested
    if (requestedProvider !== 'auto') {
      const idx = providers.findIndex(p => p.name === requestedProvider);
      if (idx > 0) {
        const [p] = providers.splice(idx, 1);
        providers.unshift(p);
      }
    }

    // Try each provider
    for (const p of providers) {
      try {
        return await p.exec();
      } catch (e: any) {
        console.error(`[${p.name}] failed:`, e.message?.slice(0, 200));
        continue;
      }
    }

    // All failed
    return jsonError('All providers failed. Please try again.');
  } catch (e: any) {
    return jsonError(e.message);
  }
}

function jsonError(msg: string) {
  return new Response(
    `data: ${JSON.stringify({ delta: `⚠️ Error: ${msg}\n\nThe app works with Pollinations.ai for free. Please check your connection and try again.` })}\ndata: ${JSON.stringify({ done: true })}\n\n`,
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  );
}

// ─── Groq / OpenAI-compatible ──────────────────────────

async function callOpenAI(url: string, key: string, model: string, messages: any[]): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
      stream: true,
      temperature: 0.75,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compat ${res.status}`);
  return sseFromOpenAI(res);
}

// ─── Pollinations (FREE, NO KEY) ───────────────────────

async function callPollinations(messages: any[]): Promise<Response> {
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' } as Record<string, string>,
    body: JSON.stringify({
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
      model: 'openai',
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return sseFromAny(res);
}

// ─── Gemini ────────────────────────────────────────────

async function callGemini(key: string, messages: any[]): Promise<Response> {
  const gmsgs = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM }] },
          { role: 'model', parts: [{ text: 'Understood.' }] },
          ...gmsgs,
        ],
        generationConfig: { temperature: 0.75, maxOutputTokens: 8192 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return sseFromGemini(res);
}

// ─── SSE Transformers ──────────────────────────────────

function sseFromOpenAI(upstream: Response): Response {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    async start(c) {
      const r = upstream.body!.getReader();
      const d = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        buf += d.decode(value, { stream: true });
        for (const line of buf.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); break; }
          try {
            const p = JSON.parse(raw);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) c.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          } catch {}
        }
        buf = '';
      }
      c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      c.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function sseFromAny(upstream: Response): Response {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    async start(c) {
      const r = upstream.body!.getReader();
      const d = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        const chunk = d.decode(value, { stream: true });

        // Check if it's SSE format
        if (chunk.includes('data: ') && chunk.includes('"delta"')) {
          buf += chunk;
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const p = JSON.parse(line.slice(6));
              const delta = p.delta || p.choices?.[0]?.delta?.content;
              if (delta) c.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            } catch {}
          }
        } else {
          // Plain text — just send it
          if (chunk.trim()) c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
      }
      c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      c.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function sseFromGemini(upstream: Response): Response {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    async start(c) {
      const r = upstream.body!.getReader();
      const d = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        buf += d.decode(value, { stream: true });
        for (const line of buf.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const p = JSON.parse(line.slice(6));
            const delta = p.candidates?.[0]?.content?.parts?.[0]?.text;
            if (delta) c.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          } catch {}
        }
        buf = '';
      }
      c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      c.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
