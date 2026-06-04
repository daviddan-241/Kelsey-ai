/**
 * POST /api/social
 * 
 * Generate realistic social media content:
 * - AI persona creation with detailed bios
 * - Post generation (Instagram, TikTok, X, Facebook, LinkedIn)
 * - Content calendars
 * - Hashtag research
 * - Caption writing
 * - Engagement strategies
 * 
 * Uses free AI (Pollinations/Groq)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { action, platform, niche, count, persona, tone } = await req.json();

  const GROQ_KEY = process.env.GROQ_API_KEY;

  const buildPrompt = () => {
    switch (action) {
      case 'persona':
        return `Create a detailed, realistic social media persona for a ${niche} content creator. Include:
- Full name (realistic)
- Age, location
- Bio (150 words, authentic)
- Personality traits
- Content style and themes
- Target audience
- Brand voice
- 10 post ideas with captions
- Hashtag strategy (30 hashtags)
- Best posting times
- Engagement tactics
- Monetization strategy
Make it feel like a real person, not AI-generated.`;

      case 'posts':
        return `Generate ${count || 5} realistic ${platform} posts for this persona:
${JSON.stringify(persona)}

For each post include:
- Caption (platform-appropriate length)
- Hashtags (relevant, mix of popular and niche)
- Best time to post
- Engagement hook
- Call to action
- Content type (photo/video/reel/carousel)
- Visual description for image generation
Tone: ${tone || 'casual and authentic'}`;

      case 'calendar':
        return `Create a 7-day content calendar for ${platform} in the ${niche} niche.
Include: post time, content type, caption, hashtags, visual description, engagement strategy.`;

      case 'captions':
        return `Write ${count || 10} ${tone || 'engaging'} captions for ${platform} about ${niche}.
Each caption should be different in style: some funny, some inspirational, some educational, some controversial.`;

      case 'hashtags':
        return `Research and provide 50 hashtags for ${platform} in the ${niche} niche.
Categorize them: high-volume (1M+), medium (100K-1M), niche (<100K).
Include a mix of broad and specific tags.`;

      default:
        return `Generate social media content for ${platform} about ${niche}.`;
    }
  };

  try {
    // Try Groq first (fastest)
    if (GROQ_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an expert social media strategist. Always provide realistic, engaging content. Format output in markdown.' },
            { role: 'user', content: buildPrompt() },
          ],
          temperature: 0.8,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ content: data.choices[0].message.content, provider: 'groq' });
      }
    }

    // Fallback: Pollinations (free)
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert social media strategist. Always provide realistic, engaging content in markdown.' },
          { role: 'user', content: buildPrompt() },
        ],
        model: 'openai',
      }),
    });

    if (response.ok) {
      const text = await response.text();
      return NextResponse.json({ content: text, provider: 'pollinations' });
    }

    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
