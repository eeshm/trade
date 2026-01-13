'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time, SingleValueData } from 'lightweight-charts';
import { PriceData } from '@/types';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CandlestickChart, AreaChart } from 'lucide-react';

interface PriceChartProps {
  prices: { [symbol: string]: PriceData };
}

type ChartType = 'candlestick' | 'area';

export function PriceChart({ prices }: PriceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const priceHistoryRef = useRef<CandlestickData<Time>[]>([]);
  const lastCandleTimeRef = useRef<number>(0);

  const solPrice = prices['SOL']?.price || '0';
  const currentPrice = parseFloat(solPrice) || 0;

  // Generate initial candlestick data (can be converted to area data)
  const generateInitialData = useCallback(() => {
    const basePrice = currentPrice;
    const data: CandlestickData<Time>[] = [];
    const now = Math.floor(Date.now() / 1000);
    const candleInterval = 60; // 1-minute candles

    for (let i = 59; i >= 0; i--) {
      const time = (now - i * candleInterval) as Time;
      const open = basePrice + (Math.random() - 0.5) * 10;
      const close = open + (Math.random() - 0.5) * 5;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;

      data.push({
        time,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
      });
    }

    return data;
  }, [currentPrice]);

  // Convert candlestick data to area data
  const convertToAreaData = useCallback((candleData: CandlestickData<Time>[]): SingleValueData<Time>[] => {
    return candleData.map(candle => ({
      time: candle.time,
      value: candle.close,
    }));
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'hsl(70.5, 1.5%, 70.5%)',
      },
      grid: {
        vertLines: { color: 'hsl(27.4, 0.6%, 27.4%)' },
        horzLines: { color: 'hsl(27.4, 0.6%, 27.4%)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'hsl(44.2, 1.7%, 44.2%)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: 'hsl(44.2, 1.7%, 44.2%)',
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: 'hsl(27.4, 0.6%, 27.4%)',
      },
      timeScale: {
        borderColor: 'hsl(27.4, 0.6%, 27.4%)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const initialData = generateInitialData();
    priceHistoryRef.current = initialData;
    lastCandleTimeRef.current = initialData[initialData.length - 1]?.time as number || Math.floor(Date.now() / 1000);

    // Create series based on chart type
    let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;

    if (chartType === 'candlestick') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      series.setData(initialData);
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineWidth: 2,
      });
      series.setData(convertToAreaData(initialData));
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [generateInitialData, chartType, convertToAreaData]);

  // Update chart with new price data
  useEffect(() => {
    if (!seriesRef.current || currentPrice === 0) return;

    const now = Math.floor(Date.now() / 1000);
    const candleInterval = 60;
    const currentCandleTime = Math.floor(now / candleInterval) * candleInterval;

    if (priceHistoryRef.current.length === 0) return;

    const lastCandle = priceHistoryRef.current[priceHistoryRef.current.length - 1];

    if (currentCandleTime > (lastCandle.time as number)) {
      // New candle
      const newCandle: CandlestickData<Time> = {
        time: currentCandleTime as Time,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
      };
      priceHistoryRef.current.push(newCandle);

      if (chartType === 'candlestick') {
        (seriesRef.current as ISeriesApi<'Candlestick'>).update(newCandle);
      } else {
        (seriesRef.current as ISeriesApi<'Area'>).update({
          time: newCandle.time,
          value: newCandle.close,
        });
      }
    } else {
      // Update existing candle
      const updatedCandle: CandlestickData<Time> = {
        ...lastCandle,
        high: Math.max(lastCandle.high, currentPrice),
        low: Math.min(lastCandle.low, currentPrice),
        close: currentPrice,
      };
      priceHistoryRef.current[priceHistoryRef.current.length - 1] = updatedCandle;

      if (chartType === 'candlestick') {
        (seriesRef.current as ISeriesApi<'Candlestick'>).update(updatedCandle);
      } else {
        (seriesRef.current as ISeriesApi<'Area'>).update({
          time: updatedCandle.time,
          value: updatedCandle.close,
        });
      }
    }
  }, [currentPrice, chartType]);

  const priceChange = priceHistoryRef.current.length > 1
    ? currentPrice - (priceHistoryRef.current[0]?.open || currentPrice)
    : 0;
  const priceChangePercent = priceHistoryRef.current.length > 1
    ? ((priceChange / (priceHistoryRef.current[0]?.open || currentPrice)) * 100)
    : 0;

  return (
    <DashboardWrapper name="SOL/USD Price Chart" className="h-full">
      <Card className="h-full overflow-hidden py-0">
        <CardContent className="flex-1 min-h-0 min-w-0 flex flex-col py-4 h-full">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                ${currentPrice.toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={chartType === 'area' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('area')}
                className="h-8 w-8 p-0"
                title="Area Chart"
              >
                <AreaChart className="h-4 w-4" />
              </Button>
              <Button
                variant={chartType === 'candlestick' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('candlestick')}
                className="h-8 w-8 p-0"
                title="Candlestick Chart"
              >
                <CandlestickChart className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <span className="text-xs text-muted-foreground mb-2 shrink-0">Real-time price via Pyth</span>
          <div ref={chartContainerRef} className="flex-1 w-full min-h-0 min-w-0" />
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}
