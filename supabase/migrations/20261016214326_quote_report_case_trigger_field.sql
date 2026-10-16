create or replace function public.snapshot_report_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select tc.title, tc.text, tc.case_id, tc.created_at,
    coalesce(new.case_priority, tc.priority, 'medium'::public.priority_string)
  into new.case_title, new.case_text, new.case_id, new.case_created_at,
    new.case_priority
  from public.test_cases tc
  where tc.id = new."case" and tc.deleted_at is null;

  if new.case_title is null then
    raise exception 'Cannot snapshot missing or deleted case %', new."case";
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', cg.id, 'title', cg.title, 'name', cg.name)
    order by cg.name, cg.id
  ), '[]'::jsonb) into new.case_groups
  from public.test_case_group_links cgl
  join public.test_case_groups cg on cg.id = cgl."group"
  where cgl.case = new."case" and cg.deleted_at is null;

  return new;
end;
$$;
