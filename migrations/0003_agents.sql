do $$
declare r record;
begin
  for r in
    select c.conname, t.relname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where c.contype = 'c'
      and t.relname in ('subscribers', 'movements')
  loop
    execute format('alter table %I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;
alter table subscribers add constraint subscribers_section_check check (section in ('cards', 'home', 'agents'));
alter table movements add constraint movements_book_check check (book in ('cards', 'home', 'ops', 'agents'));
alter table movements add constraint movements_kind_check check (kind in ('debt_add', 'debt_pay', 'expense', 'salary', 'agent_in', 'agent_out'));
