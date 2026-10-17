import { Alert, Button } from '@mui/material';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { MilesChat, type MilesMessage } from '@cs/brand';
import { friendlyError, functionErrorMessage } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { useSubscription } from '../billing/subscription';
import { JOB_COPY, jobKey, type MilesJob } from './jobs';
import { MilesContext } from './useMiles';

/** Holds Miles's conversations (one per job) and the chat panel for the whole app. */
export function MilesProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const { subscription } = useSubscription();
  const [job, setJob] = useState<MilesJob | null>(null);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Record<string, MilesMessage[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = job ? jobKey(job) : '';
  const messages = conversations[key] ?? [];
  // The server checks the plan on every message; this only spares Free users a dead end.
  const locked = subscription?.tier === 'free';

  const openMiles = useCallback((next: MilesJob) => {
    setJob(next);
    setError(null);
    setOpen(true);
  }, []);

  const send = async (text: string) => {
    if (!job) return;
    const history: MilesMessage[] = [...messages, { role: 'user', content: text }];
    setConversations((all) => ({ ...all, [key]: history }));
    setError(null);
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{ reply: string }>(
        'miles',
        {
          method: 'POST',
          body: {
            mode: job.mode,
            ...(job.incidentId ? { incidentId: job.incidentId } : {}),
            ...(job.alertId ? { alertId: job.alertId } : {}),
            messages: history,
          },
        },
      );
      if (invokeError || !data?.reply) {
        setError(await functionErrorMessage(invokeError));
        return;
      }
      setConversations((all) => ({
        ...all,
        [key]: [...history, { role: 'assistant', content: data.reply }],
      }));
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ openMiles }), [openMiles]);
  const copy = job ? JOB_COPY[job.mode] : JOB_COPY.help;

  return (
    <MilesContext.Provider value={value}>
      {children}
      <MilesChat
        open={open}
        title={copy.title}
        intro={copy.intro}
        suggestions={copy.suggestions}
        messages={messages}
        busy={busy}
        error={error}
        onSend={(text) => void send(text)}
        onClose={() => setOpen(false)}
        blocked={
          locked ? (
            <Alert
              severity="info"
              action={
                <Button
                  component={RouterLink}
                  to="/billing"
                  color="inherit"
                  size="small"
                  onClick={() => setOpen(false)}
                >
                  See plans
                </Button>
              }
            >
              Miles is included in Pro and Team.
            </Alert>
          ) : undefined
        }
      />
    </MilesContext.Provider>
  );
}
