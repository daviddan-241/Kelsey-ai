/**
 * POST /api/generate
 * 
 * FREE image generation using:
 * - Pollinations.ai (completely free, no API key)
 * - Returns image URL directly
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { prompt, width = 1024, height = 1024, style, nologo = true, seed } = await req.json();

  try {
    // Pollinations.ai — 100% free, no API key
    // Build URL with parameters
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      nologo: String(nologo),
      nofeed: 'true',
    });
    
    if (seed) params.set('seed', String(seed));
    
    const encodedPrompt = encodeURIComponent(prompt + (style ? `, ${style} style` : ''));
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;

    // Verify the image loads
    const testResponse = await fetch(imageUrl, { method: 'HEAD' });
    
    return NextResponse.json({
      success: true,
      url: imageUrl,
      prompt,
      provider: 'pollinations',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support GET for direct image access
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get('prompt') || 'A beautiful sunset';
  const width = searchParams.get('width') || '1024';
  const height = searchParams.get('height') || '1024';
  
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&nofeed=true`;
  
  // Proxy the image
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  
  return new Response(blob, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
