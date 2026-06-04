/**
 * POST /api/chat
 * 
 * Free AI chat using:
 * - Groq (free, fast LLM) — llama-3.3-70b
 * - Google Gemini (free tier)
 * - HuggingFace (free inference)
 * - Pollinations (free, no key)
 * 
 * Falls back through providers automatically.
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Provider configs ──────────────────────────────────

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    getKey: () => process.env.GROQ_API_KEY,
  },
  gemini: {
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent`,
    model: 'gemini-2.0-flash',
    getKey: () => process.env.GEMINI_API_KEY,
  },
  pollinations: {
    url: 'https://text.pollinations.ai/',
    model: 'openai',
    getKey: () => 'free', // No key needed
  },
  huggingface: {
    url: 'https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    getKey: () => process.env.HF_API_KEY,
  },
};

// ─── System prompt ─────────────────────────────────────

const SYSTEM_PROMPT = `You are Kelsey AI — a premium, all-in-one AI workspace assistant. You are powerful, intelligent, and capable of anything.

Your capabilities:
- **Code Generation**: Write production-quality code in any language (React, Python, Rust, Go, Swift, etc.)
- **Full Applications**: Build complete web apps, mobile apps, APIs, backends
- **Website Cloning**: Analyze and recreate any website
- **Social Media**: Generate realistic social media content, captions, hashtags, posting schedules
- **AI Personas**: Create detailed realistic personas with bios, post ideas, content calendars
- **Crypto & Web3**: Smart contracts, tokenomics, DeFi analysis, wallet tools
- **Image Prompts**: Generate detailed image generation prompts
- **Video Scripts**: Create video scripts, storyboards, content plans
- **Deployment**: Help deploy to Vercel, Render, Railway, Netlify
- **Security**: Kali Linux commands, penetration testing guidance
- **Data Analysis**: Process data, create visualizations, reports
- **Marketing**: SEO, content strategy, ad copy, email campaigns
- **Automation**: Workflows, bots, scripts, cron jobs

Rules:
- Always give COMPLETE, WORKING code — never placeholders
- When building apps, include ALL files needed
- Be detailed, thorough, and professional
- If asked for social media content, make it realistic and engaging
- If asked for crypto tools, provide working code
- Format code with proper markdown code blocks
- Think step by step for complex tasks`;

// ─── Route Handler ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages, model, provider: requestedProvider } = await req.json();

  try {
    // Try providers in order
    const providerOrder = ['groq', 'pollinations', 'gemini', 'huggingface'];
    
    if (requestedProvider && requestedProvider !== 'auto') {
      providerOrder.unshift(requestedProvider);
    }

    for (const providerName of providerOrder) {
      const provider = PROVIDERS[providerName as keyof typeof PROVIDERS];
      if (!provider) continue;
      
      const key = provider.getKey();
      if (!key || key === 'free') {
        // pollinations works without key
        if (providerName !== 'pollinations') continue;
      }

      try {
        if (providerName === 'groq' || providerName === 'huggingface') {
          return await streamGroq(provider, key!, messages, model);
        } else if (providerName === 'gemini') {
          return await streamGemini(provider, key!, messages);
        } else if (providerName === 'pollinations') {
          return await streamPollinations(messages, model);
        }
      } catch (e: any) {
        console.error(`Provider ${providerName} failed:`, e.message);
        continue; // Try next provider
      }
    }

    // All providers failed — return a helpful error
    return new Response(
      `data: ${JSON.stringify({ event: 'error', error: 'All AI providers failed. Add a free Groq API key at console.groq.com' })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Groq / HuggingFace (OpenAI-compatible) ────────────

async function streamGroq(provider: typeof PROVIDERS.groq, key: string, messages: any[], model?: string) {
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || provider.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);

  // Transform OpenAI stream to our SSE format
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'start' })}\n\n`));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta })}\n\n`));
              }
            } catch {}
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ─── Gemini ────────────────────────────────────────────

async function streamGemini(provider: typeof PROVIDERS.gemini, key: string, messages: any[]) {
  const url = `${provider.url}?key=${key}&alt=sse`;
  
  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Understood. I am Kelsey AI, ready to help.' }] },
        ...geminiMessages,
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'start' })}\n\n`));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta })}\n\n`));
              }
            } catch {}
          }
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ─── Pollinations (FREE, no key) ───────────────────────

async function streamPollinations(messages: any[], model?: string) {
  const response = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      model: model || 'openai',
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'start' })}\n\n`));

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta: text })}\n\n`));
        }
      } else {
        const text = await response.text();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta: text })}\n\n`));
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
