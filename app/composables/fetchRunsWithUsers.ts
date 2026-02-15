import type { Database } from "~/types/database.types"

export async function fetchRunsWithUsers(
	supabase: ReturnType<typeof useSupabaseClient<Database>>,
	runIds?: string[]
) {
	const query = supabase
		.from("test_runs")
		.select("*")
		.is("deleted_at", null)
		.order("created_at", { ascending: false })

	const { data: runsData, error: runsError } = runIds
		? await query.in("id", runIds)
		: await query

	if (runsError) {
		throw createSupabaseError(runsError)
	}

	const runsArray = runsData || []

	// Get unique creator IDs
	const creatorIds = [
		...new Set(
			runsArray.filter((run) => run.created_by).map((run) => run.created_by)
		)
	]

	if (creatorIds.length === 0) {
		return runsArray.map((run) => ({ ...run, creator: undefined }))
	}

	// Fetch user metadata for all creators using RPC function
	const filteredCreatorIds = creatorIds.filter(
		(id): id is string => id !== null
	)
	const { data: usersData, error: usersError } = await supabase.rpc(
		"get_user_metadata",
		{ user_ids: filteredCreatorIds }
	)

	if (usersError) {
		throw createSupabaseError(usersError)
	}

	// Map users to their respective runs
	return runsArray.map((run) => ({
		...run,
		creator: usersData?.find((user) => user.id === run.created_by)
	}))
}
