-- Shortens the subscription delivery-prep cutoff from 3 business days to
-- 2, per the ateliê's own call (they know their real prep lead time
-- better than the number originally guessed at). Only the cutoff-days
-- constant changes here -- everything else in build_delivery_schedule is
-- identical to 0007_delivery_schedule_weekday.sql.

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
    c_date := public.subtract_business_days(d_date, 2);
    next_seq := next_seq + 1;
    return query
      insert into public.subscription_deliveries
        (subscription_id, sequence_index, delivery_date, cutoff_date, message, recipient_name)
      values (p_subscription_id, next_seq, d_date, c_date, coalesce(p_message, ''), p_recipient_name)
      returning *;
  end loop;
end;
$$;
