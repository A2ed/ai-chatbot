'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from 'ai/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';

import { Block } from './block';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useBlockSelector } from '@/hooks/use-block';
import { toast } from 'sonner';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [patientId, setPatientId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: {
      id,
      selectedChatModel,
      patientId,
      selectedDate
    },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate('/api/history');
    },
    onError: (error) => {
      toast.error('An error occured, please try again!');
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isBlockVisible = useBlockSelector((state) => state.isVisible);

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        chatId={id}
        selectedModelId={selectedChatModel}
        selectedVisibilityType={selectedVisibilityType}
        isReadonly={isReadonly}
      />

      {/* Patient Data Controls */}
      <div className="flex flex-row gap-4 p-4 bg-muted/50">
        <div className="flex-1">
          <label htmlFor="patientId" className="block text-sm font-medium mb-1">
            Patient ID
          </label>
          <input
            id="patientId"
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter patient ID..."
            className="w-full px-3 py-2 rounded-md border bg-background"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="selectedDate" className="block text-sm font-medium mb-1">
            End Date
          </label>
          <input
            id="selectedDate"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-md border bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Data will be pulled from this date back one month
          </p>
        </div>
      </div>

      <Messages
        chatId={id}
        isLoading={isLoading}
        votes={votes}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        isReadonly={isReadonly}
        isBlockVisible={isBlockVisible}
      />

      <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
        {!isReadonly && (
          <MultimodalInput
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            setMessages={setMessages}
            append={append}
          />
        )}
      </form>

      <Block
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </div>
  );
}
