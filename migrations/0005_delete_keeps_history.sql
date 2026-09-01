do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = 'movements' and c.contype = 'f' loop
    execute format('alter table movements drop constraint %I', r.conname);
  end loop;
  for r in select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = 'movements' and c.contype = 'c' loop
    execute format('alter table movements drop constraint %I', r.conname);
  end loop;
end $$;
alter table movements add constraint movements_subscriber_id_fkey foreign key (subscriber_id) references subscribers(id) on delete set null;
alter table movements add constraint movements_amount_check check (amount >= 0);
alter table movements add constraint movements_kind_check check (kind in ('debt_add', 'debt_pay', 'expense', 'salary', 'agent_in', 'agent_out', 'account_delete'));
