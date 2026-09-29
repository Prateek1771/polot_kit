create extension if not exists pgcrypto;

create table if not exists run (
  id uuid primary key default gen_random_uuid(),
  suite text not null,
  target jsonb not null default '{}',
  label text not null default '',
  status text not null default 'queued',        -- queued | running | done | failed
  total int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists conversation (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'live',          -- live | sim
  run_id uuid references run(id) on delete cascade,
  persona text,
  prompt_variant text not null default 'good',
  status text not null default 'open',          -- open | judging | judged
  state jsonb not null default '{}',            -- bot memory: fields, awaiting_confirm, claim_id
  outcome text,
  quality_score float,
  bot_cost_usd numeric not null default 0,
  judge_cost_usd numeric not null default 0,
  ended_reason text,
  created_at timestamptz not null default now()
);
create index if not exists conversation_run on conversation(run_id);

create table if not exists message (
  id bigserial primary key,
  conversation_id uuid not null references conversation(id) on delete cascade,
  role text not null,                           -- user | assistant
  content text not null,
  jev jsonb,                                    -- router answers for this user turn
  route text,
  cards jsonb,
  latency_ms int,
  at timestamptz not null default now()
);
create index if not exists message_conv on message(conversation_id, id);

create table if not exists score (
  conversation_id uuid not null references conversation(id) on delete cascade,
  criterion text not null,
  prob float not null,
  verdict text not null,                        -- pass | fail | review
  reason text,
  human_label text,                             -- pass | fail
  primary key (conversation_id, criterion)
);

create table if not exists claim (
  id text primary key,
  conversation_id uuid references conversation(id) on delete set null,
  policy_no text not null,
  incident_date text not null,
  description text not null,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

-- policies sold through CoverWise; customers are looked up by full name
create table if not exists policy (
  policy_no text primary key,
  holder_name text not null,
  plan_id text,                                 -- catalog.yaml plan id
  category text not null,                       -- car | bike | health | term | travel
  insurer text not null,
  plan text not null,
  insured_item text,                            -- vehicle / members / life assured
  sum_insured_inr bigint,
  premium_inr int,
  start_date date not null,
  end_date date not null,
  add_ons jsonb not null default '[]',
  ncb_pct int,
  status text not null default 'active'
);
create index if not exists policy_holder on policy(lower(holder_name));
