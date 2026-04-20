-- Add subscription tier to profiles
alter table public.profiles add column if not exists subscription_tier text default 'free';

-- Create subscriptions table to track history
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null, -- 'active', 'canceled', 'expired'
  tier text not null, -- 'pro', 'premium'
  provider text not null, -- 'revenuecat'
  provider_customer_id text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Function to update gallery limit based on subscription
create or replace function public.get_gallery_limit(p_room_id uuid)
returns integer as $$
declare
  v_owner_id uuid;
  v_tier text;
begin
  select owner_id into v_owner_id from public.rooms where id = p_room_id;
  select subscription_tier into v_tier from public.profiles where id = v_owner_id;
  
  if v_tier = 'pro' then
    return 100;
  elsif v_tier = 'premium' then
    return 500;
  else
    return 20; -- Default free limit
  end if;
end;
$$ language plpgsql security definer;

-- Update the gallery limit trigger to use the function
create or replace function public.check_gallery_limit()
returns trigger as $$
declare
  v_limit integer;
begin
  v_limit := public.get_gallery_limit(new.room_id);
  if (select count(*) from public.gallery_items where room_id = new.room_id) >= v_limit then
    raise exception '갤러리 업로드 제한(%개)에 도달했습니다. 프로 플랜으로 업그레이드하세요.', v_limit;
  end if;
  return new;
end;
$$ language plpgsql;
