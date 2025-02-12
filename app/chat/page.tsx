'use client';

import { useChat } from 'ai/react';
import { TimeSeriesPlot } from '../components/TimeSeriesPlot';
import { Message } from 'ai';
import { useState } from 'react';
import { ComponentType } from 'react';
import React from 'react';

interface TimeSeriesData {
    time: string;
    percentage: number;
}

interface TimeSeriesProps {
    data: TimeSeriesData[];
    title?: string;
    height?: number;
    width?: number;
}

interface UIComponent {
    __type: 'ui-component';
    component: ComponentType<TimeSeriesProps>;
    props: TimeSeriesProps;
}

// Type guard function to check if an object is a UIComponent
function isUIComponent(obj: any): obj is UIComponent {
    return (
        obj &&
        typeof obj === 'object' &&
        '__type' in obj &&
        obj.__type === 'ui-component' &&
        'component' in obj &&
        'props' in obj
    );
}

export default function Chat() {
    const [patientId, setPatientId] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const { messages, input, handleInputChange, handleSubmit } = useChat({
        body: {
            patientId,
            selectedDate,
        },
    });

    return (
        <div className="flex flex-col w-full max-w-2xl mx-auto p-4">
            {/* Patient and Date Controls */}
            <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col space-y-2">
                    <label htmlFor="patientId" className="text-sm font-medium text-gray-700">
                        Patient ID
                    </label>
                    <input
                        id="patientId"
                        type="text"
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        placeholder="Enter patient ID..."
                        className="w-full rounded-lg border border-gray-300 p-2"
                    />
                </div>
                <div className="flex flex-col space-y-2">
                    <label htmlFor="selectedDate" className="text-sm font-medium text-gray-700">
                        End Date (Data will be pulled from this date back one month)
                    </label>
                    <input
                        id="selectedDate"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2"
                    />
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex flex-col space-y-4">
                {messages.map(m => (
                    <div key={m.id} className="whitespace-pre-wrap">
                        <strong>{m.role === 'user' ? 'User: ' : 'Assistant: '}</strong>
                        {m.content}
                        {m.role === 'assistant' &&
                            m.data &&
                            typeof m.data === 'object' &&
                            isUIComponent(m.data) && (
                                <div className="mt-4">
                                    {React.createElement(m.data.component as any, m.data.props)}
                                </div>
                            )}
                    </div>
                ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSubmit} className="mt-4">
                <input
                    className="w-full rounded-lg border border-gray-300 p-2"
                    value={input}
                    placeholder="Ask about patient data..."
                    onChange={handleInputChange}
                />
            </form>
        </div>
    );
} 