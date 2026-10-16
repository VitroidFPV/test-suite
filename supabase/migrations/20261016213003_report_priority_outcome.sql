alter table public.test_cases
  alter column priority set default 'medium'::public.priority_string;

alter table public.test_run_reports
  add column suggested_pass boolean,
  add column suggestion_reason text;

alter table public.test_run_report_case_links
  add column case_priority public.priority_string;

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
  where tc.id = new.case and tc.deleted_at is null;

  if new.case_title is null then
    raise exception 'Cannot snapshot missing or deleted case %', new.case;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', cg.id, 'title', cg.title, 'name', cg.name)
    order by cg.name, cg.id
  ), '[]'::jsonb) into new.case_groups
  from public.test_case_group_links cgl
  join public.test_case_groups cg on cg.id = cgl."group"
  where cgl.case = new.case and cg.deleted_at is null;

  return new;
end;
$$;

drop function public.get_test_reports(uuid[]);

create function public.get_test_reports(report_ids uuid[])
returns table (
  id uuid,
  created_at timestamptz,
  created_by uuid,
  run uuid,
  pass boolean,
  suggested_pass boolean,
  suggestion_reason text,
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
    r.id, r.created_at, r.created_by, r.run, r.pass,
    r.suggested_pass, r.suggestion_reason, r.title, r.comment,
    r.discussion_url, r.run_title, r.run_groups, r.snapshot_backfilled_at,
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
          'priority', rcl.case_priority,
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
