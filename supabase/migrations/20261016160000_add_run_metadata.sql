alter table public.test_run_groups
  add column image_url text,
  add column primary_channel_url text,
  add column secondary_channel_url text;

alter table public.test_runs
  add column discussion_url text;

alter table public.test_run_reports
  add column discussion_url text;

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
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', rcl.case,
          'title', tc.title,
          'text', tc.text,
          'case_id', tc.case_id,
          'created_at', tc.created_at,
          'result', rcl.result,
          'comment', rcl.comment
        ) order by tc.case_id
      ) filter (where rcl.case is not null and tc.deleted_at is null),
      '[]'::jsonb
    ) as cases
  from public.test_run_reports r
  left join public.test_run_report_case_links rcl on rcl.report = r.id
  left join public.test_cases tc on tc.id = rcl.case
  where r.id = any(report_ids)
    and r.deleted_at is null
  group by r.id, r.created_at, r.created_by, r.run, r.pass, r.title, r.comment, r.discussion_url;
end;
$$;

grant execute on function public.get_test_reports(uuid[]) to anon, authenticated, service_role;
