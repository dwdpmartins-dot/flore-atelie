-- Replaces build_delivery_schedule with a weekday-aware version.
--
-- Why: subscribers pick both a frequency (7/15/30-day cadence) AND a fixed
-- weekday. 7 divides evenly into weeks, so "Semanal" preserves the weekday
-- exactly. 15 and 30 do not (they're not multiples of 7), so a naive
-- "delivery_date + step_days" would silently drift off the chosen weekday
-- after the first cycle. Instead, each next delivery is the chosen
-- weekday's occurrence nearest the nominal step (searching from
-- step_days - 3), which keeps every cycle on the right weekday at the cost
-- of the interval being approximate (e.g. "Quinzenal" lands ~14 days apart,
-- not exactly 15) -- the weekday commitment wins over exact day-counting.

drop function if exists public.build_delivery_schedule(uuid, text, int, text, text, date);

create or replace function public.next_delivery_after(prev_date date, freq text, weekday_name text)
returns date language plpgsql immutable as $$
declare
  step int := public.freq_step_days(freq);
  window_start date := prev_date + (step - 3);
begin
  return public.next_weekday_on_or_after(window_start, weekday_name);
end;
$$;

create or replace function public.build_delivery_schedule(
  p_subscription_id uuid,
  p_freq text,
  p_weekday text,
  p_count int,
  p_message text,
  p_recipient_name text default null,
  p_first_delivery_date date default null
) returns setof public.subscription_deliveries language plpgsql as $$
declare
  d_date date;
  c_date date;
  next_seq int;
  prev_date date;
  i int;
begin
  select coalesce(max(sequence_index), 0), max(delivery_date) into next_seq, prev_date
    from public.subscription_deliveries where subscription_id = p_subscription_id;

  -- An explicit p_first_delivery_date always wins, even if this
  -- subscription has older delivery history (e.g. resuming after a pause,
  -- where the pre-pause dates are stale and must not anchor the new
  -- schedule).
  if p_first_delivery_date is not null then
    d_date := p_first_delivery_date;
  elsif prev_date is null then
    d_date := public.next_weekday_on_or_after(current_date, p_weekday);
  else
    d_date := public.next_delivery_after(prev_date, p_freq, p_weekday);
  end if;

  for i in 1..p_count loop
    if i > 1 then
      d_date := public.next_delivery_after(d_date, p_freq, p_weekday);
    end if;
    c_date := public.subtract_business_days(d_date, 3);
    next_seq := next_seq + 1;
    return query
      insert into public.subscription_deliveries
        (subscription_id, sequence_index, delivery_date, cutoff_date, message, recipient_name)
      values (p_subscription_id, next_seq, d_date, c_date, coalesce(p_message, ''), p_recipient_name)
      returning *;
  end loop;
end;
$$;
