do $$
declare item record; current_rows jsonb;
begin
  for item in select * from wm_invite_test.before_rows loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t',item.table_name) into current_rows;
    perform wm_invite_test.check_true(current_rows = item.rows, 'migration preserves table ' || item.table_name);
  end loop;
end;
$$;
