/**
 * POST /api/tools
 * 
 * General-purpose AI tools:
 * - Code generation (any language)
 * - Website cloning analysis
 * - SEO analysis
 * - Data processing
 * - File conversion
 * - Anything else
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { action, prompt, language, framework, context } = await req.json();

  const GROQ_KEY = process.env.GROQ_API_KEY;

  const systemPrompts: Record<string, string> = {
    'code': `You are an expert programmer. Generate COMPLETE, WORKING code. No placeholders, no TODOs, no incomplete code. Include all imports, error handling, and comments. The code must run as-is.`,
    'clone': `You are a web development expert. Analyze websites and recreate them. Provide complete HTML/CSS/JS or framework code that matches the original design.`,
    'seo': `You are an SEO expert. Provide detailed, actionable SEO analysis and recommendations.`,
    'debug': `You are a debugging expert. Find and fix all bugs. Explain each issue clearly.`,
    'refactor': `You are a code quality expert. Refactor code to be clean, maintainable, and performant.`,
    'explain': `You are a teacher. Explain concepts clearly with examples. Break down complex topics.`,
    'write': `You are a professional writer. Create compelling, well-structured content.`,
    'analyze': `You are a data analyst. Provide thorough analysis with insights and recommendations.`,
    'deploy': `You are a DevOps expert. Provide deployment configurations, Dockerfiles, CI/CD pipelines.`,
    'security': `You are a cybersecurity expert. Provide security audits, penetration testing guidance, and secure coding practices.`,
    'default': `You are Kelsey AI — a helpful, capable assistant. Provide thorough, detailed responses.`,
  };

  const systemPrompt = systemPrompts[action] || systemPrompts.default;

  try {
    const providers = [];
    
    if (GROQ_KEY) {
      providers.push({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 8192,
          stream: true,
        },
      });
    }

    // Always add Pollinations as fallback (free, no key)
    providers.push({
      url: 'https://text.pollinations.ai/',
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
      body: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        model: 'openai',
        stream: true,
      },
    });

    // Try each provider
    for (const provider of providers) {
      try {
        const response = await fetch(provider.url, {
          method: 'POST',
          headers: provider.headers,
          body: JSON.stringify(provider.body),
        });

        if (!response.ok) continue;

        // Stream response
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

              // Check if this is OpenAI format (has data: prefix)
              if (buffer.includes('"choices"')) {
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const d = line.slice(6).trim();
                    if (d === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(d);
                      const delta = parsed.choices?.[0]?.delta?.content;
                      if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta })}\n\n`));
                    } catch {}
                  }
                }
              } else {
                // Plain text stream (Pollinations)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', delta: buffer })}\n\n`));
                buffer = '';
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'done' })}\n\n`));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      } catch (e) {
        continue;
      }
    }

    return NextResponse.json({ error: 'All providers failed' }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
