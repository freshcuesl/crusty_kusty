-- Miles, the AI assistant: who may use it, daily limits, usage records.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000ba1', 'owner@paid11.test'),
  ('00000000-0000-0000-0000-000000000bb1', 'owner@free11.test'),
  ('00000000-0000-0000-0000-000000000bd1', 'mod@clientshield11.test');
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000bd1', 'moderator');
insert into public.businesses (id, name, created_by, verification_status) values
  ('b1100000-0000-0000-0000-00000000000a', 'Paid Eleven', '00000000-0000-0000-0000-000000000ba1', 'verified'),
  ('b1100000-0000-0000-0000-00000000000b', 'Free Eleven', '00000000-0000-0000-0000-000000000bb1', 'verified');
insert into public.business_members (business_id, user_id, role) values
  ('b1100000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000ba1', 'owner'),
  ('b1100000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000bb1', 'owner');
update public.subscriptions set tier = 'pro', status = 'active'
where business_id = 'b1100000-0000-0000-0000-00000000000a';
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

select pg_temp.sign_in('00000000-0000-0000-0000-000000000ba1', 'aal1');
select throws_ok(
  $$select public.miles_begin('help')$$,
  '42501', 'Two-step login required',
  'Miles needs two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000bb1', 'aal2');
select throws_ok(
  $$select public.miles_begin('help')$$,
  '42501', 'Miles is included in the Pro and Team plans. Upgrade in Plan and billing.',
  'Free businesses cannot use Miles'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000ba1', 'aal2');
select lives_ok(
  $$insert into started values ('paid', public.miles_begin('report_coach'))$$,
  'paying businesses can use Miles'
);
select ok(
  (select data ? 'request_id' and (data ->> 'business_id')::uuid = 'b1100000-0000-0000-0000-00000000000a'
   from started where name = 'paid'),
  'each request is recorded for the business'
);
select throws_ok(
  $$select public.miles_begin('admin')$$,
  '42501', 'Only ClientShield staff can use the admin advisor',
  'businesses cannot use the admin advisor'
);
select throws_ok(
  $$select public.miles_begin('fortune_telling')$$,
  '22023', 'Unknown Miles mode',
  'only known modes are allowed'
);
select throws_ok(
  $$select count(*) from public.miles_usage$$,
  '42501', null,
  'usage records are not readable from the app'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000bd1', 'aal2');
select lives_ok(
  $$insert into started values ('staff', public.miles_begin('admin'))$$,
  'staff can use the admin advisor'
);
select ok(
  (select data -> 'business_id' = 'null'::jsonb from started where name = 'staff'),
  'admin requests belong to no business'
);

-- Daily limit: 40 messages per person.
reset role;
insert into public.miles_usage (user_id, business_id, mode)
select '00000000-0000-0000-0000-000000000ba1', 'b1100000-0000-0000-0000-00000000000a', 'help'
from generate_series(1, 39);
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-000000000ba1', 'aal2');
select throws_ok(
  $$select public.miles_begin('help')$$,
  '54000', 'Miles has answered 40 messages for you today. Try again tomorrow.',
  'each person gets 40 Miles messages a day'
);

-- Token counts come from the server only.
select ok(
  not has_function_privilege('authenticated', 'public.miles_record_usage(uuid, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.miles_record_usage(uuid, integer, integer)', 'execute'),
  'only the server records token usage'
);
reset role;
set local role service_role;
select lives_ok(
  format('select public.miles_record_usage(%L, 1200, 300)',
    (select data ->> 'request_id' from started where name = 'paid')),
  'the server records token usage'
);
reset role;
select is(
  (select row(input_tokens, output_tokens)::text from public.miles_usage
   where id = (select (data ->> 'request_id')::uuid from started where name = 'paid')),
  '(1200,300)',
  'token usage is saved on the request'
);
select * from finish();
rollback;
