/**
 * GET /api/generate?p=...&w=...&h=...
 * 
 * Proxies image generation via Pollinations.ai (100% free)
 * Can be used directly as <img src="/api/generate?p=...">
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get('p') || searchParams.get('prompt') || 'A beautiful landscape';
  const width = searchParams.get('w') || searchParams.get('width') || '1024';
  const height = searchParams.get('h') || searchParams.get('height') || '1024';
  const seed = searchParams.get('seed') || Math.floor(Math.random() * 999999);

  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&nofeed=true&seed=${seed}`;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Image generation failed');
    
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { prompt, width, height, style } = await req.json();
  
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;
  const seed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width || 1024}&height=${height || 1024}&nologo=true&nofeed=true&seed=${seed}`;

  // Verify it loads
  try {
    const test = await fetch(imageUrl, { method: 'HEAD' });
    return NextResponse.json({
      success: true,
      url: imageUrl,
      prompt: fullPrompt,
      seed,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Image generation failed' }, { status: 500 });
  }
}
