import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, streamText } from 'ai';
import { getPatientData } from '@/lib/ai/tools/rune-labs/get-patient-data';

export async function POST(req: Request) {
    const { messages } = await req.json();

    return createDataStreamResponse({
        execute: async dataStream => {
            const result = streamText({
                model: openai('gpt-4o'),
                messages,
                tools: {
                    getPatientData
                },
                system: `You are a helpful assistant with access to patient measurement data through the Rune Labs API.
                When asked about patient data, use the getPatientData tool to fetch the information.
                The tool requires:
                - patient_id: The patient's identifier
                - selected_date: The date in ISO format
                - measurement_type: Either 'tremor' or 'dyskinesia'
                - repull_all: Optional boolean to force refresh the data
                
                Format dates properly and handle the data returned by the tool appropriately.
                Present the data in a clear, readable format for the user.`,
            });

            result.mergeIntoDataStream(dataStream);
        },
    });
} 