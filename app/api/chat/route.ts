/**
 * POST /api/chat
 * 
 * One unified chat that UNDERSTANDS everything:
 * - Social media personas, posts, content creation
 * - Crypto, smart contracts, tokenomics
 * - Image generation (triggers automatically when needed)
 * - Code generation in any language
 * - Website cloning
 * - Deployment help
 * - Kali Linux / security
 * - Marketing, SEO, business
 * - Anything else
 * 
 * Free AI providers (auto-fallback):
 * 1. Groq (fastest, free key) 
 * 2. Pollinations (no key needed at all)
 * 3. Gemini (free tier)
 */

import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are Kelsey AI — an incredibly intelligent, capable assistant. You are the brain behind a premium AI workspace with 475 specialized agents.

You understand and can do ANYTHING the user asks. Here are your capabilities — but you are NOT limited to these:

SOCIAL MEDIA & PERSONAS:
- Create realistic, detailed AI personas with full bios, personality traits, content style, posting schedules
- Generate social media posts for Instagram, TikTok, X/Twitter, Facebook, LinkedIn, YouTube
- Write captions, hashtags, engagement hooks
- Create 30-day content calendars
- Design growth strategies, monetization plans
- When asked to "create a girl" or "create a persona", provide FULL realistic details: name, age, location, bio, personality, aesthetic, content ideas, posting schedule, engagement tactics — make it feel REAL
- Generate image prompts for creating profile pictures and content visuals

CRYPTO & WEB3:
- Write Solidity smart contracts (ERC-20, ERC-721, DeFi protocols)
- Design tokenomics models with distribution, vesting, utility
- Analyze crypto markets and strategies
- Create token launch plans
- Build DeFi yield strategies

IMAGE GENERATION:
- When the user wants an image generated, output a special block:
  [IMAGE: detailed description of the image to generate]
  The system will automatically generate it.
- For persona/profile pictures: describe realistic portraits with lighting, angle, style details
- For social media content: describe the visual aesthetic

CODE GENERATION:
- Write COMPLETE, WORKING code in any language
- Never use placeholders — every line must work
- Include all files needed for a project
- React, Next.js, Python, Rust, Go, Swift, Flutter, Solidity, etc.

DEPLOYMENT:
- Render, Vercel, Railway, Netlify, Docker configs
- CI/CD pipelines
- Environment setup

SECURITY:
- Kali Linux tools and commands
- Penetration testing methodology
- Security audits

BUSINESS:
- Business plans, pitch decks
- SEO strategies
- Marketing campaigns
- Email sequences
- Revenue models

RULES:
- Always give COMPLETE, detailed responses
- When generating code: ALL files, NO placeholders, NO TODOs
- When creating personas: make them feel REAL, not AI-generated
- When writing social content: authentic, engaging, platform-specific
- Think step by step for complex tasks
- If you're not sure what the user wants, ask a clarifying question first
- Format everything beautifully with markdown`;

export async function POST(req: NextRequest) {
  const { messages, provider: requestedProvider } = await req.json();

  // Provider order: Groq (fastest) → Pollinations (always works) → Gemini
  const providers: { name: string; test: () => boolean; run: () => Promise<Response> }[] = [
    {
      name: 'groq',
      test: () => !!process.env.GROQ_API_KEY,
      run: () => streamOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        process.env.GROQ_API_KEY!,
        'llama-3.3-70b-versatile'
      ),
    },
    {
      name: 'pollinations',
      test: () => true, // Always works, no key needed
      run: () => streamPollinations(),
    },
    {
      name: 'gemini',
      test: () => !!process.env.GEMINI_API_KEY,
      run: () => streamGemini(),
    },
  ];

  // If user requested specific provider, try it first
  if (requestedProvider && requestedProvider !== 'auto') {
    const preferred = providers.find(p => p.name === requestedProvider);
    if (preferred) providers.unshift(preferred);
  }

  for (const provider of providers) {
    if (!provider.test()) continue;
    try {
      return await provider.run();
    } catch (e: any) {
      console.error(`Provider ${provider.name} failed:`, e.message);
      continue;
    }
  }

  return new Response(
    `data: ${JSON.stringify({ delta: '⚠️ No AI providers available. The app works with Pollinations.ai for free — no setup needed. Please check your connection.' })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' } }
  );

  // ─── Helper: Build messages ────────────────────────
  async function streamOpenAICompatible(url: string, key: string, model: string): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return transformOpenAIStream(response);
  }

  async function streamPollinations(): Promise<Response> {
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
      body: JSON.stringify({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        model: 'openai',
        stream: true,
      }),
    });
    if (!response.ok) throw new Error(`${response.status}`);

    // Pollinations returns plain text or SSE depending on mode
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      return transformPlainTextStream(response);
    }
    return transformOpenAIStream(response);
  }

  async function streamGemini(): Promise<Response> {
    const key = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`;
    const geminiMsgs = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: 'Understood.' }] },
          ...geminiMsgs,
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return transformGeminiStream(response);
  }
}

// ─── Stream Transformers ───────────────────────────────

function transformOpenAIStream(upstream: Response): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`)); break; }
          try {
            const p = JSON.parse(d);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          } catch {}
        }
      }
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function transformPlainTextStream(upstream: Response): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = dec.decode(value, { stream: true });
        // Try to parse as SSE first
        if (text.includes('"delta"') || text.includes('"choices"')) {
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const p = JSON.parse(line.slice(6));
                const delta = p.choices?.[0]?.delta?.content || p.delta;
                if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              } catch {}
            }
          }
        } else {
          // Plain text — chunk it
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
        }
      }
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

function transformGeminiStream(upstream: Response): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const p = JSON.parse(line.slice(6));
            const delta = p.candidates?.[0]?.content?.parts?.[0]?.text;
            if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          } catch {}
        }
      }
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
