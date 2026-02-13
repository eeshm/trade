import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 15;

const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const asset = searchParams.get('asset') || 'SOL';
  const timeframe = searchParams.get('timeframe') || '1m';
  const limit = searchParams.get('limit') || '1000';

  const upstreamUrl = `${API_BASE_URL}/market/candles?asset=${encodeURIComponent(asset)}&timeframe=${encodeURIComponent(timeframe)}&limit=${encodeURIComponent(limit)}`;
  const emptyPayload = {
    success: true,
    asset,
    timeframe,
    count: 0,
    candles: [],
    currentCandle: null,
  };

  try {
    const response = await fetch(upstreamUrl, {
      next: {
        revalidate,
        tags: ['market-candles'],
      },
    });

    if (!response.ok) {
      return NextResponse.json(emptyPayload, {
        status: 200,
        headers: {
          'x-upstream-status': String(response.status),
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(emptyPayload, {
      status: 200,
      headers: {
        'x-upstream-error': error instanceof Error ? error.name : 'UnknownError',
      },
    });
  }
}