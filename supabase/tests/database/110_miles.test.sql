-- Miles, the customer service assistant: who may chat, daily limit, usage records.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000bb1', 'owner@free11.test'),
  ('00000000-0000-0000-0000-000000000bc1', 'nobusiness@test11.test');
insert into public.businesses (id, name, created_by, verification_status) values
  ('b1100000-0000-0000-0000-00000000000b', 'Free Eleven', '00000000-0000-0000-0000-000000000bb1', 'verified');
insert into public.business_members (business_id, user_id, role) values
  ('b1100000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000bb1', 'owner');
update public.subscriptions set trial_ends_at = now() - interval '1 day'
where business_id = 'b1100000-0000-0000-0000-00000000000b';

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;
create temporary table started (name text primary key, data jsonb);
grant all on started to authenticated, service_role;

set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-000000000bb1', 'aal1');
select throws_ok(
  $$select public.miles_begin()$$,
  '42501', 'Two-step login required',
  'Miles needs two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000bb1', 'aal2');
select lives_ok(
  $$insert into started values ('free', public.miles_begin())$$,
  'Free businesses can chat with Miles: support is never behind a paywall'
);
select is(
  (select (data ->> 'business_id')::uuid from started where name = 'free'),
  'b1100000-0000-0000-0000-00000000000b'::uuid,
  'each request is recorded for the business'
);
select throws_ok(
  $$select count(*) from public.miles_usage$$,
  '42501', null,
  'usage records are not readable from the app'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000bc1', 'aal2');
select lives_ok(
  $$select public.miles_begin()$$,
  'people still setting up their business can ask for help too'
);

-- Daily limit: 20 messages per person.
reset role;
insert into public.miles_usage (user_id, business_id)
select '00000000-0000-0000-0000-000000000bb1', 'b1100000-0000-0000-0000-00000000000b'
from generate_series(1, 19);
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-000000000bb1', 'aal2');
select throws_ok(
  $$select public.miles_begin()$$,
  '54000', 'Miles has answered 20 messages for you today. Try again tomorrow.',
  'each person gets 20 Miles messages a day'
);

select ok(
  not has_function_privilege('authenticated', 'public.miles_record_usage(uuid, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.miles_record_usage(uuid, integer, integer)', 'execute'),
  'only the server records token usage'
);
reset role;
set local role service_role;
select lives_ok(
  format('select public.miles_record_usage(%L, 1200, 300)',
    (select data ->> 'request_id' from started where name = 'free')),
  'the server records token usage'
);
reset role;
select is(
  (select row(input_tokens, output_tokens)::text from public.miles_usage
   where id = (select (data ->> 'request_id')::uuid from started where name = 'free')),
  '(1200,300)',
  'token usage is saved on the request'
);

select * from finish();
rollback;
