-- Miles, ClientShield's customer service assistant (AI). The `miles` Edge
-- Function calls miles_begin() as the signed-in person before every answer: it
-- checks two-step login and the daily limit, then records the request.
-- Conversations are never stored; only token counts are kept, for cost tracking.

create table public.miles_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index miles_usage_user_day on public.miles_usage (user_id, created_at desc);

-- No grants and no policies: only database functions and the server read it.
alter table public.miles_usage enable row level security;

/** Every signed-in person may ask Miles for help, up to 20 messages a day. */
create function public.miles_begin() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_id uuid;
  v_limit integer := 20;
begin
  perform private.require_aal2();

  if (
    select count(*) from public.miles_usage
    where user_id = auth.uid() and created_at > now() - interval '1 day'
  ) >= v_limit then
    raise exception 'Miles has answered % messages for you today. Try again tomorrow.', v_limit
      using errcode = '54000';
  end if;

  select business_id into v_business_id from public.business_members where user_id = auth.uid();
  insert into public.miles_usage (user_id, business_id)
  values (auth.uid(), v_business_id)
  returning id into v_id;

  return jsonb_build_object('request_id', v_id, 'business_id', v_business_id);
end;
$$;

/** Server only: token counts reported by the Claude API for a request. */
create function public.miles_record_usage(
  p_request_id uuid,
  p_input_tokens integer,
  p_output_tokens integer
) returns void
language sql security definer
set search_path = ''
as $$
  update public.miles_usage
  set input_tokens = p_input_tokens, output_tokens = p_output_tokens
  where id = p_request_id;
$$;

grant execute on function public.miles_begin() to authenticated;
grant execute on function public.miles_record_usage(uuid, integer, integer) to service_role;
