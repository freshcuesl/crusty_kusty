import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MilesChat, type MilesMessage } from '@cs/brand';
import { friendlyError, functionErrorMessage } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { MilesContext } from './useMiles';

const SUGGESTIONS = [
  'How do customer checks work?',
  'How do I get verified?',
  'How do I change my plan?',
];

/** Miles, the customer service assistant: one conversation and the chat panel. */
export function MilesProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MilesMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openMiles = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const send = async (text: string) => {
    const history: MilesMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setError(null);
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{ reply: string }>(
        'miles',
        { method: 'POST', body: { messages: history } },
      );
      if (invokeError || !data?.reply) {
        setError(await functionErrorMessage(invokeError));
        return;
      }
      setMessages([...history, { role: 'assistant', content: data.reply }]);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ openMiles }), [openMiles]);

  return (
    <MilesContext.Provider value={value}>
      {children}
      <MilesChat
        open={open}
        title="Customer service"
        intro="Hi, I'm Miles. Ask me anything about using ClientShield: checks, verification, plans and billing. If I can't help, I'll point you to a person."
        suggestions={SUGGESTIONS}
        messages={messages}
        busy={busy}
        error={error}
        onSend={(text) => void send(text)}
        onClose={() => setOpen(false)}
      />
    </MilesContext.Provider>
  );
}
