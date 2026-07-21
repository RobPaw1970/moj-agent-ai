begin;

alter table public.conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

delete from public.messages
where conversation_id in (select id from public.conversations where user_id is null);
delete from public.conversations where user_id is null;
delete from public.user_profiles
where not exists (select 1 from auth.users where auth.users.id = public.user_profiles.id);

alter table public.conversations alter column user_id set not null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "Users manage own conversations" on public.conversations;
create policy "Users manage own conversations"
on public.conversations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage messages in own conversations" on public.messages;
create policy "Users manage messages in own conversations"
on public.messages for all
using (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists "Users manage own profile" on public.user_profiles;
create policy "Users manage own profile"
on public.user_profiles for all
using (auth.uid() = id)
with check (auth.uid() = id);

do $$
begin
  if to_regclass('public.documents') is not null then
    alter table public.documents
      add column if not exists user_id uuid references auth.users(id) on delete cascade;
    delete from public.documents where user_id is null;
    alter table public.documents enable row level security;
    drop policy if exists "Users manage own documents" on public.documents;
    create policy "Users manage own documents"
      on public.documents for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

commit;
