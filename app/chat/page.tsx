'use client';

import { useChat } from 'ai/react';

export default function Chat() {
    const { messages, input, handleInputChange, handleSubmit } = useChat();

    return (
        <div className="flex flex-col w-full max-w-2xl mx-auto p-4">
            <div className="flex flex-col space-y-4">
                {messages.map(m => (
                    <div
                        key={m.id}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
                        <div
                            className={`rounded-lg px-4 py-2 max-w-sm ${m.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-black'
                                }`}
                        >
                            {m.content}
                        </div>
                    </div>
                ))}
            </div>

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