type RunGroupLink = { run: string; group: string }
type RunGroup = { id: string; title: string }

export function indexRunGroupsByRunId<T extends RunGroup>(
	groups: T[],
	links: RunGroupLink[]
): Map<string, T[]> {
	const groupsById = new Map(groups.map((group) => [group.id, group]))
	const groupsByRunId = new Map<string, T[]>()

	for (const link of links) {
		const group = groupsById.get(link.group)
		if (!group) continue

		const runGroups = groupsByRunId.get(link.run) ?? []
		runGroups.push(group)
		groupsByRunId.set(link.run, runGroups)
	}

	for (const runGroups of groupsByRunId.values()) {
		runGroups.sort(
			(a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
		)
	}

	return groupsByRunId
}
