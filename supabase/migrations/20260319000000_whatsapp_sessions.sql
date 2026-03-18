create table if not exists whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  message_sid text unique not null,
  from_number text not null,
  raw_input text,
  media_type text,
  claude_plan jsonb,
  status text default 'pending_approval',
  github_run_id bigint,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 minutes')
);

alter table whatsapp_sessions enable row level security;

-- Only service role can read/write (Edge Function uses service key)
create policy "service only" on whatsapp_sessions
  using (false) with check (false);
