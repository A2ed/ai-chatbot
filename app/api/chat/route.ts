import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, streamText } from 'ai';
import { getPatientData } from '@/lib/ai/tools/rune-labs/get-patient-data';

export async function POST(req: Request) {
    const { messages, patientId, selectedDate } = await req.json();

    return createDataStreamResponse({
        execute: async dataStream => {
            const result = streamText({
                model: openai('gpt-4'),
                messages,
                tools: {
                    getPatientData
                },
                system: `You are a helpful assistant with access to patient measurement data through the Rune Labs API.
                When asked about patient data, use the getPatientData tool to fetch the information.
                
                The current patient ID is: ${patientId || 'not set'}
                The selected date is: ${selectedDate || 'not set'}
                
                The tool requires:
                - patient_id: Use the provided patient ID from the context
                - selected_date: Use the provided selected date from the context
                - measurement_type: Either 'tremor' or 'dyskinesia'
                - repull_all: Optional boolean to force refresh the data
                
                Always use the provided patient ID and selected date when making tool calls.
                If either is not set, inform the user they need to provide these values.
                Present the data in a clear, readable format for the user.`,
            });

            result.mergeIntoDataStream(dataStream);
        },
    });
} 