import { tool } from 'ai';
import { z } from 'zod';
import { TimeSeriesPlot } from '@/app/components/TimeSeriesPlot';

export interface PlotData {
    time: string;
    percentage: number;
}

export const plotPatientData = tool({
    description: 'Plot time series data from patient measurements in an interactive chart. This tool should be called immediately after getPatientData to visualize the data.',
    parameters: z.object({
        data: z.array(z.object({
            time: z.string(),
            percentage: z.number()
        })).describe('The data array returned from getPatientData (data.data)'),
        title: z.string().optional().default('Patient Measurement Data').describe('A descriptive title for the plot'),
        height: z.number().optional().default(400),
        width: z.number().optional().default(800)
    }),
    execute: async ({ data, title, height, width }: {
        data: PlotData[];
        title?: string;
        height?: number;
        width?: number;
    }) => {
        if (!Array.isArray(data)) {
            throw new Error('Data must be an array of time series points');
        }

        if (data.length === 0) {
            throw new Error('Data array is empty');
        }

        // Validate data format
        if (!data.every(point =>
            typeof point.time === 'string' &&
            typeof point.percentage === 'number'
        )) {
            throw new Error('Each data point must have time (string) and percentage (number)');
        }

        return {
            __type: 'ui-component',
            component: TimeSeriesPlot,
            props: {
                data,
                title: title || 'Patient Measurement Data',
                height: height || 400,
                width: width || 800
            }
        };
    }
}); 