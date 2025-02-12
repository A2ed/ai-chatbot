'use client';

import { useEffect, useId, useRef, useState, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import React from 'react';
import type { Data, Layout, Config } from 'plotly.js-dist-min';

// Define the correct types for Plotly
interface PlotlyProps {
    data: Data[];
    layout: Partial<Layout>;
    config?: Partial<Config>;
    className?: string;
}

// Dynamically import Plotly to avoid SSR issues
export const Plot = dynamic(
    () =>
        import('plotly.js-dist-min').then(({ newPlot, purge }) => {
            const Plot = forwardRef<HTMLDivElement, PlotlyProps>(({ data, layout, config, className }, ref) => {
                const plotId = useId();
                const plotRef = useRef<HTMLDivElement>(null);
                const [handle, setHandle] = useState<any>(undefined);

                useEffect(() => {
                    let instance: any;
                    if (plotRef.current) {
                        newPlot(plotRef.current, data, layout, config).then((ref) =>
                            setHandle((instance = ref))
                        );
                    }
                    return () => {
                        instance && purge(instance);
                    };
                }, [data, layout, config]);

                return <div id={plotId} ref={plotRef} className={className} />;
            });
            Plot.displayName = 'Plot';
            return Plot;
        }),
    { ssr: false }
);

interface TimeSeriesData {
    time: string;
    percentage: number;
}

interface TimeSeriesPlotProps {
    data: TimeSeriesData[];
    title?: string;
    height?: number;
    width?: number;
}

export function TimeSeriesPlot({ data, title = 'Time Series Data', height = 400, width = 800 }: TimeSeriesPlotProps) {
    const plotData: Data[] = [{
        x: data.map(d => d.time),
        y: data.map(d => d.percentage),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Percentage',
    }];

    const layout: Partial<Layout> = {
        title: title,
        height: height,
        width: width,
        xaxis: {
            title: 'Time',
            tickformat: '%Y-%m-%d %H:%M',
        },
        yaxis: {
            title: 'Percentage',
            range: [0, 100],
        },
        margin: { t: 40 },
    };

    const config: Partial<Config> = {
        responsive: true
    };

    return (
        <Plot
            data={plotData}
            layout={layout}
            config={config}
            className="w-full"
        />
    );
} 