'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';

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
                    <div
                        key={m.id}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`rounded-lg px-4 py-2 max-w-sm ${m.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-black'
                                }`}
                        >
                            {m.content}
                            {m.toolInvocations && (
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
                                    {JSON.stringify(m.toolInvocations, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSubmit} className="mt-4">
                <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask about patient data..."
                    className="w-full rounded-lg border border-gray-300 p-2"
                />
            </form>
        </div>
    );
} 