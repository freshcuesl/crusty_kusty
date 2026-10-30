// Miles, ClientShield's customer service assistant. See _shared/miles.ts.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAdmin, requireEnv } from '../_shared/clients.ts';
import { handleMiles } from '../_shared/miles.ts';

const MODEL = 'claude-opus-5-5';

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

Deno.serve((req) =>
  handleMiles(req, {
    appUrl: requireEnv('APP_URL'),
    supportEmail: Deno.env.get('SUPPORT_EMAIL') || undefined,

    async begin(authHeader) {
      const { data, error } = await asCaller(authHeader).rpc('miles_begin');
      if (error) throw error;
      return { requestId: (data as { request_id: string }).request_id };
    },

    // Only the plan and usage, so Miles can answer "how many checks do I have left?".
    async loadAccount(authHeader) {
      const { data } = await asCaller(authHeader).rpc('my_subscription');
      if (!data) return null;
      const s = data as Record<string, unknown>;
      return JSON.stringify({
        plan_name: s.plan_name,
        checks_used_this_month: s.checks_used,
        monthly_checks: s.monthly_checks ?? 'unlimited',
        members: s.members,
        max_members: s.max_members,
        trial_ends_at: s.trial_ends_at,
        billing_status: s.status,
        is_owner: s.can_manage,
      });
    },

    async ask({ system, messages }) {
      const response = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // A declined request is retried on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Support answers are short and factual; Opus 5.5 always thinks, low keeps it quick.
        output_config: { effort: 'low' },
        // The system prompt is identical for every request, so it caches.
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
