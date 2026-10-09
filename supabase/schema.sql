-- Schema per 龙龙中文: account dei genitori + progressi di Noah.
-- Si incolla nel "SQL Editor" di Supabase (una volta sola).

-- Progressi: una riga per account. Il genitore legge e scrive solo la propria.
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;
create policy "progress_select_own" on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress_insert_own" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress_update_own" on public.progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Piano completo: l'app può solo LEGGERE. Lo scrive il server (acquisto verificato) o tu a mano dal pannello.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  premium boolean not null default false,
  source text,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);

-- Elimina l'account e tutti i dati (obbligatorio per gli store se l'app crea account).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Per dare il piano completo a un account (esempio, da SQL Editor):
--   insert into public.entitlements (user_id, premium, source)
--   select id, true, 'manuale' from auth.users where email = 'genitore@example.com'
--   on conflict (user_id) do update set premium = true, source = 'manuale', updated_at = now();
