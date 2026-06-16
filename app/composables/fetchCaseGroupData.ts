import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types/database.types"

export async function fetchCaseGroupData(
	supabase: SupabaseClient<Database>,
	caseIds: string[]
) {
	if (caseIds.length === 0) {
		return { groups: [], links: [] }
	}

	const { data: links, error: linksError } = await supabase
		.from("test_case_group_links")
		.select("case, group")
		.in("case", caseIds)

	if (linksError) {
		throw createSupabaseError(linksError)
	}

	const groupIds = [...new Set((links ?? []).map((link) => link.group))]

	if (groupIds.length === 0) {
		return { groups: [], links: links ?? [] }
	}

	const { data: groups, error: groupsError } = await supabase
		.from("test_case_groups")
		.select("id, title, name")
		.in("id", groupIds)
		.is("deleted_at", null)

	if (groupsError) {
		throw createSupabaseError(groupsError)
	}

	return { groups: groups ?? [], links: links ?? [] }
}
