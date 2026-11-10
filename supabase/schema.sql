-- ملعبي: schema for a NEW Supabase project only.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_type text not null check (venue_type in ('خماسي','سداسي')),
  area text not null default '',
  hourly_price numeric(10,2) not null check (hourly_price >= 0),
  surface text not null default 'عشب صناعي',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists venues_name_unique on public.venues(name);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  venue_id uuid not null references public.venues(id),
  customer_name text not null,
  customer_phone text not null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  hourly_price numeric(10,2) not null,
  platform_commission numeric(10,2) not null default 0,
  venue_payout numeric(10,2) not null,
  created_at timestamptz not null default now(),
  constraint booking_valid_period check (slot_end > slot_start)
);

-- Atomic database-level protection against two customers booking the same venue/time.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (venue_id with =, tstzrange(slot_start,slot_end,'[)') with &&)
  where (status <> 'cancelled');

alter table public.venues enable row level security;
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Anyone can view active venues" on public.venues;
create policy "Anyone can view active venues" on public.venues for select using (is_active = true);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Admins can manage venues" on public.venues;
create policy "Admins can manage venues" on public.venues
  for all to authenticated
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "Admins can read all bookings" on public.bookings;
create policy "Admins can read all bookings" on public.bookings
  for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.create_public_booking(
  p_venue_id uuid, p_customer_name text, p_customer_phone text,
  p_slot_start timestamptz, p_slot_end timestamptz
) returns table(booking_code text, booking_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_venue public.venues%rowtype;
  v_booking public.bookings%rowtype;
  v_local_start timestamp;
  v_commission numeric(10,2);
begin
  if length(trim(coalesce(p_customer_name,''))) < 2 then
    raise exception 'يرجى إدخال الاسم بشكل صحيح';
  end if;
  if length(regexp_replace(coalesce(p_customer_phone,''),'[^0-9]','','g')) < 7 then
    raise exception 'يرجى إدخال رقم هاتف صحيح';
  end if;
  if p_slot_end <= p_slot_start or p_slot_end-p_slot_start <> interval '1 hour' then
    raise exception 'مدة الحجز ساعة واحدة';
  end if;
  if p_slot_start < now() or p_slot_start > now()+interval '7 days' then
    raise exception 'الحجز متاح خلال الأيام السبعة القادمة فقط';
  end if;

  v_local_start := p_slot_start at time zone 'Africa/Tripoli';
  if not (v_local_start::time >= time '15:00' or v_local_start::time < time '02:00') then
    raise exception 'المواعيد تبدأ من 3 عصرًا';
  end if;
  if v_local_start::time = time '02:00' or v_local_start::time >= time '02:00' and v_local_start::time < time '15:00' then
    raise exception 'الموعد خارج ساعات الحجز';
  end if;

  select * into v_venue from public.venues where id=p_venue_id and is_active=true;
  if not found then raise exception 'الملعب غير متاح'; end if;

  -- Temporary commission default: 10%, to be confirmed before launch.
  v_commission := round(v_venue.hourly_price*0.10,2);
  insert into public.bookings(
    venue_id,customer_name,customer_phone,slot_start,slot_end,
    hourly_price,platform_commission,venue_payout
  ) values (
    p_venue_id,trim(p_customer_name),trim(p_customer_phone),p_slot_start,p_slot_end,
    v_venue.hourly_price,v_commission,v_venue.hourly_price-v_commission
  ) returning * into v_booking;
  return query select v_booking.booking_code,v_booking.id;
exception when exclusion_violation then
  raise exception 'هذا الموعد محجوز بالفعل. اختر وقتًا آخر';
end;
$$;

revoke all on function public.create_public_booking(uuid,text,text,timestamptz,timestamptz) from public;
grant execute on function public.create_public_booking(uuid,text,text,timestamptz,timestamptz) to anon,authenticated;

-- Public availability lookup returns only free hourly starts, never customer data.
create or replace function public.get_public_available_slots(
  p_venue_id uuid, p_local_day date
) returns table(slot_start timestamptz, slot_end timestamptz)
language sql stable security definer set search_path=public,pg_temp as $
  with candidates as (
    select (p_local_day::timestamp + make_interval(hours => h)) at time zone 'Africa/Tripoli' as starts_at
    from generate_series(15,25) as h
  )
  select c.starts_at, c.starts_at + interval '1 hour'
  from candidates c
  where c.starts_at > now()
    and exists(select 1 from public.venues v where v.id=p_venue_id and v.is_active=true)
    and not exists (
      select 1 from public.bookings b
      where b.venue_id=p_venue_id
        and b.status <> 'cancelled'
        and tstzrange(b.slot_start,b.slot_end,'[)') &&
            tstzrange(c.starts_at,c.starts_at+interval '1 hour','[)')
    )
  order by c.starts_at;
$;

revoke all on function public.get_public_available_slots(uuid,date) from public;
grant execute on function public.get_public_available_slots(uuid,date) to anon,authenticated;

insert into public.venues(name,venue_type,area,hourly_price)
select 'ملعب ملعبي '||lpad(n::text,2,'0'),
       case when n<=10 then 'خماسي' else 'سداسي' end,
       'يُحدّد لاحقًا',
       case when n<=10 then 80 else 100 end
from generate_series(1,20) n
on conflict (name) do nothing;
