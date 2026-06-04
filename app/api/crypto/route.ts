/**
 * GET /api/crypto
 * 
 * Real crypto market data from CoinGecko (free)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const [marketsRes, trendingRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 },
      }),
      fetch('https://api.coingecko.com/api/v3/search/trending', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 },
      }),
    ]);

    const markets = marketsRes.ok ? await marketsRes.json() : [];
    const trending = trendingRes.ok ? await trendingRes.json() : { coins: [] };

    return NextResponse.json({
      markets: markets.slice(0, 20).map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        image: c.image,
        price: c.current_price,
        change24h: c.price_change_percentage_24h,
        marketCap: c.market_cap,
        rank: c.market_cap_rank,
      })),
      trending: (trending.coins || []).slice(0, 7).map((c: any) => ({
        name: c.item?.name,
        symbol: c.item?.symbol?.toUpperCase(),
        marketCapRank: c.item?.market_cap_rank,
        priceBtc: c.item?.price_btc,
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, markets: [], trending: [] }, { status: 500 });
  }
}
