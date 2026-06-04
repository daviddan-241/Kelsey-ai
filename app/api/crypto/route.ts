/**
 * POST /api/crypto
 * 
 * Crypto & Web3 tools (all using free APIs):
 * - Token price lookup (CoinGecko free)
 * - Wallet analysis
 * - Smart contract generation
 * - Tokenomics design
 * - DeFi strategies
 * - Market analysis
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { action, data } = await req.json();

  try {
    switch (action) {
      case 'price': {
        const { ids } = data;
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
        );
        const prices = await res.json();
        return NextResponse.json({ prices });
      }

      case 'market': {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false'
        );
        const markets = await res.json();
        return NextResponse.json({ markets });
      }

      case 'trending': {
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const trending = await res.json();
        return NextResponse.json({ trending });
      }

      case 'contract': {
        // Generate smart contract using AI
        const GROQ_KEY = process.env.GROQ_API_KEY;
        const prompt = `Generate a complete, working Solidity smart contract for: ${data.description}
        
Include:
- SPDX license
- Pragma version
- Full implementation with comments
- Events
- Modifiers
- Error handling
- Gas optimization
Return ONLY the Solidity code.`;

        const response = await fetch(GROQ_KEY 
          ? 'https://api.groq.com/openai/v1/chat/completions' 
          : 'https://text.pollinations.ai/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(GROQ_KEY ? { 'Authorization': `Bearer ${GROQ_KEY}` } : {}),
          },
          body: JSON.stringify({
            model: GROQ_KEY ? 'llama-3.3-70b-versatile' : 'openai',
            messages: [
              { role: 'system', content: 'You are a Solidity expert. Return only valid, compilable Solidity code.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
          }),
        });

        const result = GROQ_KEY ? await response.json() : { choices: [{ message: { content: await response.text() } }] };
        return NextResponse.json({ 
          contract: GROQ_KEY ? result.choices[0].message.content : result.choices[0].message.content 
        });
      }

      case 'tokenomics': {
        const GROQ_KEY = process.env.GROQ_API_KEY;
        const prompt = `Design a detailed tokenomics model for: ${data.project}
        
Include:
- Token name and symbol
- Total supply
- Distribution breakdown (percentages)
- Vesting schedules
- Token utility
- Staking rewards
- Governance model
- Deflationary mechanisms
- Initial pricing strategy
- ROI projections
Format in detailed markdown.`;

        const response = await fetch(GROQ_KEY 
          ? 'https://api.groq.com/openai/v1/chat/completions' 
          : 'https://text.pollinations.ai/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(GROQ_KEY ? { 'Authorization': `Bearer ${GROQ_KEY}` } : {}),
          },
          body: JSON.stringify({
            model: GROQ_KEY ? 'llama-3.3-70b-versatile' : 'openai',
            messages: [
              { role: 'system', content: 'You are a tokenomics expert. Provide detailed, professional analysis.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });

        const result = GROQ_KEY ? await response.json() : { choices: [{ message: { content: await response.text() } }] };
        return NextResponse.json({ content: result.choices?.[0]?.message?.content || result });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
