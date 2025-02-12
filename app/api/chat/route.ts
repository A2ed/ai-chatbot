import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, streamText } from 'ai';
import { getPatientData } from '@/lib/ai/tools/rune-labs/get-patient-data';
import { plotPatientData } from '@/lib/ai/tools/plot-patient-data';

export async function POST(req: Request) {
    const { messages, patientId, selectedDate } = await req.json();

    // Validate required parameters
    if (!patientId || patientId === 'not set') {
        return new Response(
            JSON.stringify({
                error: 'Please enter a valid patient ID before requesting data visualization.'
            }),
            { status: 400 }
        );
    }

    return createDataStreamResponse({
        execute: async dataStream => {
            try {
                const result = streamText({
                    model: openai('gpt-4'),
                    messages: [
                        ...messages,
                        {
                            role: 'system',
                            content: `You are a medical data visualization assistant. Your task is to fetch and visualize patient data.

When asked to show or plot data:
1. Say "Let me fetch and visualize that data for you."
2. Use getPatientData to fetch the data
3. After receiving the data, use plotPatientData to create the visualization
4. Finally, describe what the plot shows.

Current patient: ${patientId}
Selected date: ${selectedDate}`
                        }
                    ],
                    maxSteps: 4,
                    toolChoice: 'required',
                    tools: {
                        getPatientData: {
                            ...getPatientData,
                            description: 'Fetches patient measurement data. Returns { data: Array<{ time: string, percentage: number }> }.'
                        },
                        plotPatientData: {
                            ...plotPatientData,
                            description: 'Creates a plot from the data array. Takes { data: Array<{ time: string, percentage: number }> }.'
                        }
                    },
                    temperature: 0,
                    onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
                        console.log('\n=== Step Completed ===');
                        console.log('Step Text:', text ? text.trim() : 'No text');

                        if (toolCalls?.length) {
                            toolCalls.forEach((call, idx) => {
                                console.log(`Tool Call ${idx + 1}:`, {
                                    name: call.toolName,
                                    toolCallId: call.toolCallId,
                                    args: call.toolName === 'getPatientData' ? {
                                        patient_id: call.args.patient_id,
                                        selected_date: call.args.selected_date,
                                        measurement_type: call.args.measurement_type
                                    } : {
                                        dataLength: call.args.data?.length || 0
                                    }
                                });
                            });
                        }

                        if (toolResults?.length) {
                            toolResults.forEach((result, idx) => {
                                if (result.type === 'tool-result' && result.result) {
                                    console.log(`Tool Result ${idx + 1}:`, {
                                        name: result.toolName,
                                        type: result.type,
                                        success: true,
                                        dataInfo: result.toolName === 'getPatientData'
                                            ? `${result.result.data?.length || 0} records`
                                            : 'Plot component'
                                    });
                                }
                            });
                        }

                        console.log('Finish Reason:', finishReason);
                        console.log('Token Usage:', usage);
                        console.log('=====================\n');
                    }
                });

                result.mergeIntoDataStream(dataStream);
            } catch (error) {
                console.error('Error in chat route:', error);
                if (error instanceof Error) {
                    console.error('Error details:', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });
                }

                const errorMessage = error instanceof Error && error.message.includes('ToolInvocation')
                    ? "Failed to complete the visualization sequence. Please try again."
                    : "Failed to process your request. Please try again.";

                dataStream.write(`2:{"type":"error","error":"${errorMessage}"}\n`);
            }
        }
    });
} 