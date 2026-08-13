-- Date/business-day logic for subscriptions, kept in Postgres so it's the
-- single source of truth (not duplicated between the cron job and the app).
-- Mirrors the prototype's subtractBusinessDays / buildDeliverySchedule exactly.

create or replace function public.subtract_business_days(d date, n int)
returns date language plpgsql immutable as $$
declare
  result date := d;
  remaining int := n;
begin
  while remaining > 0 loop
    result := result - 1;
    if extract(dow from result) not in (0,6) then -- 0=Sun, 6=Sat
      remaining := remaining - 1;
    end if;
  end loop;
  return result;
end;
$$;

-- Next date on/after `d` that falls on the given PT weekday name.
create or replace function public.next_weekday_on_or_after(d date, weekday_name text)
returns date language plpgsql immutable as $$
declare
  target_dow int;
  result date := d;
begin
  target_dow := case weekday_name
    when 'Domingo' then 0 when 'Segunda' then 1 when 'Terça' then 2
    when 'Quarta' then 3 when 'Quinta' then 4 when 'Sexta' then 5
    when 'Sábado' then 6 else 1 end;
  while extract(dow from result) <> target_dow loop
    result := result + 1;
  end loop;
  return result;
end;
$$;

create or replace function public.freq_step_days(freq text)
returns int language sql immutable as $$
  select case freq when 'Semanal' then 7 when 'Quinzenal' then 15 else 30 end;
$$;

-- Appends `p_count` future deliveries to a subscription, starting `p_start_date`
-- (defaults to today). Each delivery's cutoff_date = delivery_date minus 3
-- business days, matching the cutoff rule everywhere else in the app.
create or replace function public.build_delivery_schedule(
  p_subscription_id uuid,
  p_freq text,
  p_count int,
  p_message text,
  p_recipient_name text default null,
  p_start_date date default current_date
) returns setof public.subscription_deliveries language plpgsql as $$
declare
  step int := public.freq_step_days(p_freq);
  cur date := p_start_date;
  i int;
  d_date date;
  c_date date;
  next_seq int;
begin
  select coalesce(max(sequence_index), 0) into next_seq
    from public.subscription_deliveries where subscription_id = p_subscription_id;

  for i in 1..p_count loop
    cur := cur + step;
    d_date := cur;
    c_date := public.subtract_business_days(d_date, 3);
    next_seq := next_seq + 1;
    return query
      insert into public.subscription_deliveries
        (subscription_id, sequence_index, delivery_date, cutoff_date, message, recipient_name)
      values (p_subscription_id, next_seq, d_date, c_date, coalesce(p_message,''), p_recipient_name)
      returning *;
  end loop;
end;
$$;

-- True once "today" has reached/passed a delivery's cutoff_date — the
-- single predicate every screen (badges, pause/cancel copy, plan-change
-- gating) should use instead of recomputing it client-side.
create or replace function public.is_cutoff_passed(p_cutoff_date date)
returns boolean language sql stable as $$
  select current_date >= p_cutoff_date;
$$;
