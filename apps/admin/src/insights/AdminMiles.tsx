import { Button } from '@mui/material';
import { useState } from 'react';
import { MilesAvatar, MilesChat, type MilesMessage } from '@cs/brand';
import { friendlyError, functionErrorMessage } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';

/** Miles as the admin advisor: reads the same Insights numbers staff see. */
export function AdminMiles() {
  const supabase = useAdminSupabase();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MilesMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (text: string) => {
    const history: MilesMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setError(null);
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{ reply: string }>(
        'miles',
        { method: 'POST', body: { mode: 'admin', messages: history } },
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

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<MilesAvatar size={22} />}
        onClick={() => setOpen(true)}
      >
        Ask Miles
      </Button>
      <MilesChat
        open={open}
        title="Admin advisor"
        intro="I can read these Insights numbers. Ask me what changed, what stands out, or how to handle a moderation question."
        suggestions={[
          'What stands out lately?',
          'Where should moderators focus this week?',
          'How do I handle an abuse flag?',
        ]}
        messages={messages}
        busy={busy}
        error={error}
        onSend={(text) => void send(text)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
