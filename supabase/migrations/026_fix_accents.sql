-- =====================================================================
-- Swapfume - 026: fix accents scrambled by clipboard copying (Mac Roman).
-- Only changes text that is still scrambled, so on a clean database it does nothing.
-- =====================================================================
create temporary table if not exists _mojibake (bad text primary key, good text not null);
delete from _mojibake;
insert into _mojibake (bad, good) values
    (U&'\201A\00C4\00EE', U&'\2014'),
    (U&'\201A\00C4\00EC', U&'\2013'),
    (U&'\201A\00C4\00B6', U&'\2026'),
    (U&'\201A\00DC\00ED', U&'\2192'),
    (U&'\201A\00C4\00F4', U&'\2019'),
    (U&'\201A\00C4\00F2', U&'\2018'),
    (U&'\201A\00C4\00FA', U&'\201C'),
    (U&'\201A\00C4\00F9', U&'\201D'),
    (U&'\221A\2020', U&'\00E0'),
    (U&'\221A\00B0', U&'\00E1'),
    (U&'\221A\00A2', U&'\00E2'),
    (U&'\221A\00A3', U&'\00E3'),
    (U&'\221A\00A7', U&'\00E4'),
    (U&'\221A\2022', U&'\00E5'),
    (U&'\0192\00C5', U&'\0101'),
    (U&'\221A\00DF', U&'\00E7'),
    (U&'\0192\00E1', U&'\0107'),
    (U&'\0192\00E7', U&'\010D'),
    (U&'\221A\00AE', U&'\00E8'),
    (U&'\221A\00A9', U&'\00E9'),
    (U&'\221A\2122', U&'\00EA'),
    (U&'\221A\00B4', U&'\00EB'),
    (U&'\0192\00EC', U&'\0113'),
    (U&'\0192\00F3', U&'\0117'),
    (U&'\0192\00F4', U&'\0119'),
    (U&'\221A\00A8', U&'\00EC'),
    (U&'\221A\2260', U&'\00ED'),
    (U&'\221A\00C6', U&'\00EE'),
    (U&'\221A\00D8', U&'\00EF'),
    (U&'\0192\00B4', U&'\012B'),
    (U&'\221A\00B1', U&'\00F1'),
    (U&'\2248\00D1', U&'\0144'),
    (U&'\221A\2264', U&'\00F2'),
    (U&'\221A\2265', U&'\00F3'),
    (U&'\221A\00A5', U&'\00F4'),
    (U&'\221A\00B5', U&'\00F5'),
    (U&'\221A\2202', U&'\00F6'),
    (U&'\221A\220F', U&'\00F8'),
    (U&'\2248\00E7', U&'\014D'),
    (U&'\221A\03C0', U&'\00F9'),
    (U&'\221A\222B', U&'\00FA'),
    (U&'\221A\00AA', U&'\00FB'),
    (U&'\221A\00BA', U&'\00FC'),
    (U&'\2248\00B4', U&'\016B'),
    (U&'\221A\03A9', U&'\00FD'),
    (U&'\221A\00F8', U&'\00FF'),
    (U&'\2248\00E6', U&'\017E'),
    (U&'\2248\222B', U&'\017A'),
    (U&'\2248\00BA', U&'\017C'),
    (U&'\2248\00B0', U&'\0161'),
    (U&'\2248\00F5', U&'\015B'),
    (U&'\2248\00C7', U&'\0142'),
    (U&'\2248\00EC', U&'\0153'),
    (U&'\221A\00B6', U&'\00E6'),
    (U&'\221A\00E2', U&'\00C9'),
    (U&'\0152\2020', U&'\03A0'),
    (U&'\221A\00C4', U&'\00C0'),
    (U&'\221A\00E9', U&'\00CE'),
    (U&'\221A\00DC', U&'\00C6'),
    (U&'\00AC\221E', U&'\00B0'),
    (U&'\221A\00F3', U&'\00D7'),
    (U&'\00AC\2211', U&'\00B7'),
    (U&'\0192\00C9', U&'\0103'),
    (U&'\00BB\00F4', U&'\0219'),
    (U&'\00BB\00F5', U&'\021B'),
    (U&'\2248\00FC', U&'\015F'),
    (U&'\2248\00A3', U&'\0163'),
    (U&'\0192\00C7', U&'\0102'),
    (U&'\221A\00C7', U&'\00C2'),
    (U&'\00BB\00F2', U&'\0218'),
    (U&'\00BB\00F6', U&'\021A'),
    (U&'\2248\00FB', U&'\015E'),
    (U&'\2248\00A2', U&'\0162'),
    (U&'\221A\00C5', U&'\00C1'),
    (U&'\221A\00C9', U&'\00C3'),
    (U&'\221A\00D1', U&'\00C4'),
    (U&'\221A\00D6', U&'\00C5'),
    (U&'\221A\00E0', U&'\00C8'),
    (U&'\221A\00E4', U&'\00CA'),
    (U&'\221A\00E3', U&'\00CB'),
    (U&'\221A\00E5', U&'\00CC'),
    (U&'\221A\00E7', U&'\00CD'),
    (U&'\221A\00E8', U&'\00CF'),
    (U&'\221A\00ED', U&'\00D2'),
    (U&'\221A\00EC', U&'\00D3'),
    (U&'\221A\00EE', U&'\00D4'),
    (U&'\221A\00EF', U&'\00D5'),
    (U&'\221A\00F1', U&'\00D6'),
    (U&'\221A\00F4', U&'\00D9'),
    (U&'\221A\00F6', U&'\00DA'),
    (U&'\221A\00F5', U&'\00DB'),
    (U&'\221A\00FA', U&'\00DC'),
    (U&'\221A\00E1', U&'\00C7'),
    (U&'\221A\00EB', U&'\00D1'),
    (U&'\2248\00ED', U&'\0152'),
    (U&'\221A\00F2', U&'\00D8');

create or replace function pg_temp.unscramble(t text) returns text language plpgsql stable as $f$
declare r record;
begin
  if t is null then return t; end if;
  for r in select bad, good from _mojibake order by length(bad) desc, bad loop
    if strpos(t, r.bad) > 0 then t := replace(t, r.bad, r.good); end if;
  end loop;
  return t;
end $f$;

do $$
declare r record; v_def text; n int; total int := 0;
begin
  -- 1. Constraints whose rule text is scrambled: remember them and drop them for now.
  create temporary table _fixcons (tbl regclass, name text, def text) on commit drop;
  for r in select c.conrelid::regclass tbl, c.conname, pg_get_constraintdef(c.oid) def
             from pg_constraint c join pg_namespace s on s.oid = c.connamespace
            where s.nspname = 'public' and c.contype = 'c' loop
    if pg_temp.unscramble(r.def) <> r.def then
      insert into _fixcons values (r.tbl, r.conname, pg_temp.unscramble(r.def));
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end if;
  end loop;

  -- 2. Functions (bodies, messages, accent-folding lists): recreate them unscrambled.
  for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.prokind in ('f', 'p') loop
    v_def := pg_get_functiondef(r.oid);
    if pg_temp.unscramble(v_def) <> v_def then execute pg_temp.unscramble(v_def); total := total + 1; end if;
  end loop;
  raise notice 'functions fixed: %', total;

  -- 3. Text in every table (text and text[] columns, not generated ones).
  for r in select a.attrelid::regclass tbl, a.attname col, format_type(a.atttypid, a.atttypmod) typ
             from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
              and format_type(a.atttypid, a.atttypmod) in ('text', 'text[]', 'character varying') loop
    if r.typ = 'text[]' then
      execute format('update %s set %I = (select array_agg(pg_temp.unscramble(x) order by i) from unnest(%I) with ordinality u(x, i))
                      where array_to_string(%I, chr(31)) <> pg_temp.unscramble(array_to_string(%I, chr(31)))', r.tbl, r.col, r.col, r.col, r.col);
    else
      execute format('update %s set %I = pg_temp.unscramble(%I) where %I <> pg_temp.unscramble(%I)', r.tbl, r.col, r.col, r.col, r.col);
    end if;
    get diagnostics n = row_count;
    if n > 0 then raise notice '%.%: % rows fixed', r.tbl, r.col, n; end if;
  end loop;

  -- 4. Put the constraints back, now with the correct text.
  for r in select * from _fixcons loop
    execute format('alter table %s add constraint %I %s', r.tbl, r.name, r.def);
  end loop;
end $$;

-- 5. Rebuild the catalog's duplicate-check index with the fixed accent folding.
reindex table public.perfumes;
