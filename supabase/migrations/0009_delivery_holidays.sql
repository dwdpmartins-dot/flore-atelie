-- Extends subscription delivery-date scheduling to skip holidays too, not
-- just weekends. Mirrors the exact same holiday set as
-- src/lib/delivery/holidays.ts (fixed national + São Paulo state/city
-- dates, plus Easter-based movable ones via the same algorithm) so the
-- two never drift apart -- both need to agree on what counts as a
-- deliverable day.
--
-- Deliberately scoped to delivery dates only. subtract_business_days
-- (which computes cutoff_date, the internal charge-processing date, 3
-- business days before delivery) is left untouched -- that governs
-- billing timing for already-active subscriptions and the recurring cron,
-- which is a separate, higher-stakes change from what was asked for here.

create or replace function public.easter_sunday(p_year int)
returns date language plpgsql immutable as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19*a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2*e + 2*i - h - k) % 7;
  m int := (a + 11*h + 22*l) / 451;
  result_month int := (h + l - 7*m + 114) / 31;
  result_day int := ((h + l - 7*m + 114) % 31) + 1;
begin
  return make_date(p_year, result_month, result_day);
end;
$$;

create or replace function public.is_holiday(p_date date)
returns boolean language plpgsql immutable as $$
declare
  y int := extract(year from p_date);
  e date := public.easter_sunday(y);
  m int := extract(month from p_date);
  d int := extract(day from p_date);
begin
  -- Fixed-date national + São Paulo state/city holidays.
  if (m, d) in (
    (1,1),   -- Confraternização Universal
    (1,25),  -- Aniversário da cidade de São Paulo
    (4,21),  -- Tiradentes
    (5,1),   -- Dia do Trabalho
    (7,9),   -- Revolução Constitucionalista de 1932 (SP)
    (9,7),   -- Independência do Brasil
    (10,12), -- Nossa Senhora Aparecida
    (11,2),  -- Finados
    (11,15), -- Proclamação da República
    (11,20), -- Consciência Negra
    (12,25)  -- Natal
  ) then
    return true;
  end if;

  -- Movable (Easter-based): Carnaval (segunda/terça), Sexta-feira Santa,
  -- Corpus Christi. Treated as non-delivery days even though some are
  -- technically "pontos facultativos" rather than statutory holidays --
  -- deliveries don't run in São Paulo on these days in practice.
  if p_date in (e - 48, e - 47, e - 2, e + 60) then
    return true;
  end if;

  return false;
end;
$$;

-- Same signature as before -- create or replace upgrades it in place.
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
  -- If this occurrence lands on a holiday, move to the *same weekday* a
  -- week later rather than a different weekday -- the customer picked a
  -- fixed weekday, so that commitment should hold even when a specific
  -- date isn't deliverable. next_delivery_after (0007) calls this
  -- function too, so recurring cycles inherit this automatically.
  while public.is_holiday(result) loop
    result := result + 7;
  end loop;
  return result;
end;
$$;
