import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import {
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  friendlyError,
  type EvidenceKind,
  type IncidentCategory,
} from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError } from '../auth/ui';
import { AskMilesButton } from '../miles/AskMilesButton';
import { DECISION_LABELS, formatMonth, type AlertDecision } from './format';

export interface IncidentFacts {
  category: IncidentCategory;
  service_month: string;
  evidence_count: number;
  evidence_kinds: EvidenceKind[];
  review_rating: number | null;
  customer_response: string | null;
  expires_month: string | null;
}

export interface CheckResult {
  alert_id: string | null;
  incident_count: number;
  incidents: IncidentFacts[];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {children}
      </Typography>
    </Box>
  );
}

function IncidentCard({ facts }: { facts: IncidentFacts }) {
  const kinds = facts.evidence_kinds.map((k) => EVIDENCE_LABELS[k]).join(', ');
  return (
    <Paper
      component="article"
      aria-label={`Incident from ${formatMonth(facts.service_month)}`}
      variant="outlined"
      sx={{ p: 2 }}
    >
      <Fact label="Reported by">Verified business</Fact>
      <Fact label="When">{formatMonth(facts.service_month)}</Fact>
      <Fact label="Dispute">{CATEGORY_LABELS[facts.category]}</Fact>
      {facts.review_rating !== null && (
        <Fact label="Review">{facts.review_rating}-star Google review</Fact>
      )}
      <Fact label="Evidence">
        {facts.evidence_count} {facts.evidence_count === 1 ? 'item' : 'items'}
        {kinds ? `: ${kinds}` : ''}
      </Fact>
      <Fact label="Outcome">Evidence verified by ClientShield</Fact>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Customer response: {facts.customer_response ?? 'none yet'}
        {facts.expires_month ? ` · Record expires ${formatMonth(facts.expires_month)}` : ''}
      </Typography>
    </Paper>
  );
}

interface MatchResultProps {
  result: CheckResult;
  initialDecision?: AlertDecision | null;
}

/** The answer to a customer check: all clear, or a factual alert with choices. */
export function MatchResult({ result, initialDecision = null }: MatchResultProps) {
  const supabase = useSupabase();
  const headingId = useId();
  const [decision, setDecision] = useState<AlertDecision | null>(initialDecision);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<AlertDecision | null>(null);

  if (result.incident_count === 0 || !result.alert_id) {
    return (
      <Alert severity="success" role="status" icon={<CheckCircleOutlined />}>
        No verified incidents found for these details.
      </Alert>
    );
  }

  const decide = async (choice: AlertDecision) => {
    setError(null);
    setBusy(choice);
    try {
      const { error: rpcError } = await supabase.rpc('respond_to_alert', {
        p_alert_id: result.alert_id,
        p_decision: choice,
      });
      if (rpcError) return setError(friendlyError(rpcError));
      setDecision(choice);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(null);
    }
  };

  const count = result.incident_count;
  return (
    <Paper
      component="section"
      aria-labelledby={headingId}
      sx={{
        p: { xs: 2, sm: 3 },
        border: 1,
        borderColor: 'warning.main',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <WarningAmberOutlined sx={{ color: 'warning.main' }} aria-hidden="true" />
          <Typography id={headingId} variant="h6" component="h2">
            Verified incident found
          </Typography>
        </Stack>
        <Typography>
          {count} verified {count === 1 ? 'incident' : 'incidents'} reported by other service
          businesses match these customer details. Each was documented with evidence and checked by
          a ClientShield moderator. You decide how to proceed.
        </Typography>
        <AskMilesButton
          job={{ mode: 'alert_advisor', alertId: result.alert_id }}
          label="Ask Miles about this alert"
        />
        {result.incidents.map((facts, index) => (
          <IncidentCard key={index} facts={facts} />
        ))}
        <FormError message={error} />
        {decision ? (
          <Alert severity="info" role="status">
            Decision saved: {DECISION_LABELS[decision]}
          </Alert>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              onClick={() => void decide('continue_booking')}
              loading={busy === 'continue_booking'}
            >
              Continue booking
            </Button>
            <Button
              variant="outlined"
              onClick={() => void decide('require_authorization')}
              loading={busy === 'require_authorization'}
            >
              Require additional authorization
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => void decide('decline_job')}
              loading={busy === 'decline_job'}
            >
              Decline job
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
