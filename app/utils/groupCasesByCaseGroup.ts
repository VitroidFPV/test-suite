import type { Tables } from "~/types/database.types"

export const UNGROUPED_CASE_GROUP_LABEL = "Ungrouped"

export type CaseGroupSection<T extends { id: string }> = {
	group: string
	cases: T[]
}

type CaseGroup = Pick<Tables<"test_case_groups">, "id" | "title" | "name">
type CaseGroupLink = Pick<Tables<"test_case_group_links">, "case" | "group">

export function groupCasesByCaseGroup<T extends { id: string }>(
	cases: T[],
	groups: CaseGroup[],
	links: CaseGroupLink[],
	sortOrderByCaseId?: Map<string, number>
): CaseGroupSection<T>[] {
	if (cases.length === 0) {
		return []
	}

	const sortWithinGroup = (groupCases: T[]) => {
		if (!sortOrderByCaseId) {
			return groupCases
		}

		return [...groupCases].sort(
			(a, b) =>
				(sortOrderByCaseId.get(a.id) ?? 0) - (sortOrderByCaseId.get(b.id) ?? 0)
		)
	}

	const caseIds = new Set(cases.map((testCase) => testCase.id))
	const relevantLinks = links.filter((link) => caseIds.has(link.case))
	const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name))

	const sections: CaseGroupSection<T>[] = []

	for (const group of sortedGroups) {
		const groupCaseIds = new Set(
			relevantLinks
				.filter((link) => link.group === group.id)
				.map((link) => link.case)
		)
		const groupCases = sortWithinGroup(
			cases.filter((testCase) => groupCaseIds.has(testCase.id))
		)
		if (groupCases.length > 0) {
			sections.push({ group: group.title, cases: groupCases })
		}
	}

	const groupedCaseIds = new Set(relevantLinks.map((link) => link.case))
	const ungroupedCases = sortWithinGroup(
		cases.filter((testCase) => !groupedCaseIds.has(testCase.id))
	)
	if (ungroupedCases.length > 0) {
		sections.push({
			group: UNGROUPED_CASE_GROUP_LABEL,
			cases: ungroupedCases
		})
	}

	if (sections.length === 0) {
		return [
			{ group: UNGROUPED_CASE_GROUP_LABEL, cases: sortWithinGroup(cases) }
		]
	}

	return sections
}
