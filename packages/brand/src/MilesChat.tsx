import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { brand } from './tokens';

export interface MilesMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MilesChatProps {
  open: boolean;
  /** The job Miles is doing, e.g. "Report coach". */
  title: string;
  /** Shown before the conversation starts. */
  intro: string;
  messages: MilesMessage[];
  busy: boolean;
  error: string | null;
  suggestions?: string[];
  /** Replaces the message box, e.g. an upgrade note on the Free plan. */
  blocked?: ReactNode;
  onSend(text: string): void;
  onClose(): void;
}

/** Miles's avatar: an "M" in brand teal. */
export function MilesAvatar({ size = 36 }: { size?: number }) {
  return (
    <Avatar
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        bgcolor: brand.teal,
        color: brand.midnight,
        fontWeight: 800,
        fontSize: size * 0.45,
      }}
    >
      M
    </Avatar>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

/** The Miles chat panel. Presentational: the app supplies messages and sending. */
export function MilesChat({
  open,
  title,
  intro,
  messages,
  busy,
  error,
  suggestions = [],
  blocked,
  onSend,
  onClose,
}: MilesChatProps) {
  const titleId = useId();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, busy]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    onSend(clean);
    setDraft('');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': titleId,
          sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          px: 2,
          py: 1.5,
          pt: 'calc(12px + env(safe-area-inset-top))',
          bgcolor: brand.midnight,
          color: brand.mist,
        }}
      >
        <MilesAvatar />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={titleId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Miles
          </Typography>
          <Typography variant="body2" sx={{ color: brand.haze }}>
            {title}
          </Typography>
        </Box>
        <IconButton aria-label="Close Miles" onClick={onClose} sx={{ color: brand.mist }}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box
        role="log"
        aria-live="polite"
        aria-label="Conversation with Miles"
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Typography color="text.secondary">{intro}</Typography>
        {messages.length === 0 && suggestions.length > 0 && !blocked && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {suggestions.map((s) => (
              <Chip key={s} label={s} onClick={() => send(s)} variant="outlined" clickable />
            ))}
          </Stack>
        )}
        {messages.map((m, i) => (
          <Box
            key={i}
            sx={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              px: 1.75,
              py: 1.25,
              borderRadius: 3,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(m.role === 'user'
                ? { bgcolor: brand.midnight, color: brand.mist, borderBottomRightRadius: 4 }
                : { bgcolor: 'action.hover', color: 'text.primary', borderBottomLeftRadius: 4 }),
            }}
          >
            <Typography component="p" sx={{ m: 0 }}>
              {m.content}
            </Typography>
          </Box>
        ))}
        {busy && (
          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Miles is thinking…
          </Typography>
        )}
        <div ref={endRef} />
      </Box>

      <Box
        sx={{
          p: 2,
          pt: 1,
          pb: 'calc(16px + env(safe-area-inset-bottom))',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {blocked ?? (
          <Stack
            component="form"
            direction="row"
            spacing={1}
            sx={{ alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <TextField
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask Miles…"
              multiline
              maxRows={5}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { 'aria-label': 'Message Miles', maxLength: 4000 } }}
            />
            <Button type="submit" variant="contained" disabled={busy}>
              Send
            </Button>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Miles is an AI assistant and can make mistakes. He never decides who was right. Check
          anything important.
        </Typography>
      </Box>
    </Drawer>
  );
}
