// Miles, ClientShield's AI assistant. Reads only what each job needs, using the
// signed-in person's own permissions, then asks Claude. See _shared/miles.ts.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAdmin, requireEnv } from '../_shared/clients.ts';
import { handleMiles, type MilesMode } from '../_shared/miles.ts';

const MODEL = 'claude-opus-5-5';
// Opus 5.5 always thinks; effort sets how much. Quick answers for how-to, more care for advice.
const EFFORT: Record<MilesMode, 'low' | 'medium'> = {
  help: 'low',
  report_coach: 'medium',
  alert_advisor: 'medium',
  admin: 'medium',
};

let anthropic: Anthropic | undefined;
function claude(): Anthropic {
  anthropic ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return anthropic;
}

/** A Supabase client acting as the caller, so row-level security applies. */
function asCaller(authHeader: string) {
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? requireEnv('SUPABASE_PUBLISHABLE_KEY');
  return createClient(requireEnv('SUPABASE_URL'), key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadContext(
  authHeader: string,
  mode: MilesMode,
  ref: { incidentId: string | undefined; alertId: string | undefined },
): Promise<string | null> {
  const db = asCaller(authHeader);
  if (mode === 'alert_advisor' && ref.alertId) {
    const { data, error } = await db.rpc('alert_details', { p_alert_id: ref.alertId });
    if (error) throw error;
    // Facts only: never the name the business typed for its customer.
    const { incidents, decision } = data as { incidents: unknown; decision: unknown };
    return JSON.stringify({ alert: { decision, incidents } });
  }
  if (mode === 'report_coach' && ref.incidentId) {
    const { data: incident, error } = await db
      .from('incidents')
      .select(
        'status, category, service_date, service_type, description, review_rating, review_text, review_note',
      )
      .eq('id', ref.incidentId)
      .single();
    if (error) throw error;
    const { data: evidence } = await db
      .from('incident_evidence')
      .select('kind')
      .eq('incident_id', ref.incidentId);
    return JSON.stringify({
      incident_report: incident,
      evidence_kinds: (evidence ?? []).map((e) => e.kind),
    });
  }
  if (mode === 'admin') {
    const { data, error } = await db.rpc('admin_insights', { p_weeks: 12 });
    if (error) throw error;
    return JSON.stringify({ insights: data });
  }
  if (mode === 'help') {
    const { data } = await db.rpc('my_subscription');
    if (!data) return null;
    const { plan_name, checks_used, monthly_checks, members, max_members, trial_ends_at, status } =
      data as Record<string, unknown>;
    return JSON.stringify({
      their_plan: {
        plan_name,
        checks_used,
        monthly_checks,
        members,
        max_members,
        trial_ends_at,
        status,
      },
    });
  }
  return null;
}

const allowedOrigins = [requireEnv('APP_URL'), Deno.env.get('ADMIN_URL')].filter((o): o is string =>
  Boolean(o),
);

Deno.serve((req) =>
  handleMiles(req, {
    allowedOrigins,

    async begin(authHeader, mode) {
      const { data, error } = await asCaller(authHeader).rpc('miles_begin', { p_mode: mode });
      if (error) throw error;
      const started = data as { request_id: string; business_id: string | null };
      return { requestId: started.request_id, businessId: started.business_id };
    },

    loadContext,

    async ask({ mode, system, messages }) {
      const response = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // A declined request is retried on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: EFFORT[mode] },
        // The system prompt is identical for every request in a mode, so it caches.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      });
      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim();
      return {
        text,
        refused: response.stop_reason === 'refusal',
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_read_input_tokens ?? 0) +
          (response.usage.cache_creation_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      };
    },

    async recordUsage(requestId, inputTokens, outputTokens) {
      const { error } = await getAdmin().rpc('miles_record_usage', {
        p_request_id: requestId,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
      });
      if (error) console.error('miles: could not record usage', error);
    },
  }),
);
