alter table public.test_run_reports
  add column run_title text,
  add column run_groups jsonb not null default '[]'::jsonb,
  add column snapshot_backfilled_at timestamptz;

alter table public.test_run_report_case_links
  add column case_title text,
  add column case_text text,
  add column case_id bigint,
  add column case_created_at timestamptz,
  add column case_groups jsonb not null default '[]'::jsonb;

-- Existing reports can only capture the case and group details visible now.
update public.test_run_reports r
set run_title = (
    select tr.title from public.test_runs tr
    where tr.id = r.run and tr.deleted_at is null
  ),
  run_groups = coalesce((
    select jsonb_agg(
      jsonb_build_object('id', g.id, 'title', g.title, 'image_url', g.image_url)
      order by g.title, g.id
    )
    from public.test_run_group_links gl
    join public.test_run_groups g on g.id = gl."group"
    where gl.run = r.run and g.deleted_at is null
  ), '[]'::jsonb),
  snapshot_backfilled_at = now();

update public.test_run_report_case_links rcl
set case_title = tc.title,
  case_text = tc.text,
  case_id = tc.case_id,
  case_created_at = tc.created_at,
  case_groups = coalesce((
    select jsonb_agg(
      jsonb_build_object('id', cg.id, 'title', cg.title, 'name', cg.name)
      order by cg.name, cg.id
    )
    from public.test_case_group_links cgl
    join public.test_case_groups cg on cg.id = cgl."group"
    where cgl.case = tc.id and cg.deleted_at is null
  ), '[]'::jsonb)
from public.test_cases tc
where tc.id = rcl.case and tc.deleted_at is null;

create function public.snapshot_report_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select tr.title into new.run_title
  from public.test_runs tr
  where tr.id = new.run and tr.deleted_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', g.id, 'title', g.title, 'image_url', g.image_url)
    order by g.title, g.id
  ), '[]'::jsonb) into new.run_groups
  from public.test_run_group_links gl
  join public.test_run_groups g on g.id = gl."group"
  where gl.run = new.run and g.deleted_at is null;

  return new;
end;
$$;

create trigger snapshot_report_run_before_insert
before insert on public.test_run_reports
for each row execute function public.snapshot_report_run();

create function public.snapshot_report_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select tc.title, tc.text, tc.case_id, tc.created_at
  into new.case_title, new.case_text, new.case_id, new.case_created_at
  from public.test_cases tc
  where tc.id = new.case and tc.deleted_at is null;

  if new.case_title is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object('id', cg.id, 'title', cg.title, 'name', cg.name)
      order by cg.name, cg.id
    ), '[]'::jsonb) into new.case_groups
    from public.test_case_group_links cgl
    join public.test_case_groups cg on cg.id = cgl."group"
    where cgl.case = new.case and cg.deleted_at is null;
  end if;

  return new;
end;
$$;

create trigger snapshot_report_case_before_insert
before insert on public.test_run_report_case_links
for each row execute function public.snapshot_report_case();

drop function public.get_test_reports(uuid[]);

create function public.get_test_reports(report_ids uuid[])
returns table (
  id uuid,
  created_at timestamptz,
  created_by uuid,
  run uuid,
  pass boolean,
  title text,
  comment text,
  discussion_url text,
  run_title text,
  run_groups jsonb,
  snapshot_backfilled_at timestamptz,
  cases jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if array_length(report_ids, 1) > 50 then
    raise exception 'Cannot fetch more than 50 reports at once';
  end if;

  if array_length(report_ids, 1) is null or array_length(report_ids, 1) = 0 then
    raise exception 'At least one report ID is required';
  end if;

  return query
  select
    r.id,
    r.created_at,
    r.created_by,
    r.run,
    r.pass,
    r.title,
    r.comment,
    r.discussion_url,
    r.run_title,
    r.run_groups,
    r.snapshot_backfilled_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', rcl.case,
          'title', rcl.case_title,
          'text', rcl.case_text,
          'case_id', rcl.case_id,
          'created_at', rcl.case_created_at,
          'result', rcl.result,
          'comment', rcl.comment,
          'groups', rcl.case_groups
        ) order by rcl.sort_order, rcl.case
      ) filter (where rcl.case_title is not null),
      '[]'::jsonb
    ) as cases
  from public.test_run_reports r
  left join public.test_run_report_case_links rcl on rcl.report = r.id
  where r.id = any(report_ids)
    and r.deleted_at is null
  group by r.id;
end;
$$;

grant execute on function public.get_test_reports(uuid[]) to anon, authenticated, service_role;
