import type { Tables } from "~/types/database.types"
import {
	groupCasesByCaseGroup,
	type CaseGroupSection
} from "~/utils/groupCasesByCaseGroup"

type PlanLink = Pick<Tables<"test_plan_case_links">, "case" | "sort_order">
type RunLink = Pick<Tables<"test_run_case_links">, "case" | "sort_order">
type ReportLink = Pick<
	Tables<"test_run_report_case_links">,
	"case" | "sort_order"
>
type CaseGroup = Pick<Tables<"test_case_groups">, "id" | "title" | "name">
type CaseGroupLink = Pick<Tables<"test_case_group_links">, "case" | "group">

export function linkSortOrderMap(
	links: Array<{ case: string; sort_order: number }>
): Map<string, number> {
	return new Map(links.map((link) => [link.case, link.sort_order]))
}

export function groupCasesWithSortOrder<T extends { id: string }>(
	cases: T[],
	groups: CaseGroup[],
	groupLinks: CaseGroupLink[],
	sortLinks: Array<{ case: string; sort_order: number }>
): CaseGroupSection<T>[] {
	return groupCasesByCaseGroup(
		cases,
		groups,
		groupLinks,
		linkSortOrderMap(sortLinks)
	)
}

export function flattenGroupedSections<T extends { id: string }>(
	sections: CaseGroupSection<T>[]
): T[] {
	return sections.flatMap((section) => section.cases)
}

export function groupPlanCases<T extends { id: string }>(
	cases: T[],
	groups: CaseGroup[],
	groupLinks: CaseGroupLink[],
	planLinks: PlanLink[]
): CaseGroupSection<T>[] {
	const planCaseIds = new Set(planLinks.map((link) => link.case))
	const planCases = cases.filter((testCase) => planCaseIds.has(testCase.id))

	return groupCasesByCaseGroup(
		planCases,
		groups,
		groupLinks,
		linkSortOrderMap(planLinks)
	)
}

export function getOrderedPlanCaseIds(
	cases: Array<{ id: string }>,
	groups: CaseGroup[],
	groupLinks: CaseGroupLink[],
	planLinks: PlanLink[]
): string[] {
	return flattenGroupedSections(
		groupPlanCases(cases, groups, groupLinks, planLinks)
	).map((testCase) => testCase.id)
}

export function sortCasesByLinkOrder<T extends { id: string }>(
	cases: T[],
	links: Array<{ case: string; sort_order: number }>
): T[] {
	const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]))

	return [...links]
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((link) => casesById.get(link.case))
		.filter((testCase): testCase is T => testCase !== undefined)
}

export function sortOrderMapFromSections<T extends { id: string }>(
	sections: CaseGroupSection<T>[]
): Map<string, number> {
	const sortOrder = new Map<string, number>()
	let sortIndex = 0

	for (const section of sections) {
		for (const testCase of section.cases) {
			sortOrder.set(testCase.id, sortIndex)
			sortIndex++
		}
	}

	return sortOrder
}

export function computeSortOrdersForPlanSave(
	selectedCaseIds: string[],
	groupSections: CaseGroupSection<{ id: string }>[],
	existingSortOrder: Map<string, number>
): Map<string, number> {
	const selectedSet = new Set(selectedCaseIds)
	const sortOrder = new Map<string, number>()
	let sortIndex = 0

	for (const section of groupSections) {
		const casesInPlan = section.cases.filter((testCase) =>
			selectedSet.has(testCase.id)
		)

		const sortedCases = [...casesInPlan].sort((a, b) => {
			const aIsNew = !existingSortOrder.has(a.id)
			const bIsNew = !existingSortOrder.has(b.id)

			if (aIsNew && bIsNew) {
				return 0
			}
			if (aIsNew) {
				return 1
			}
			if (bIsNew) {
				return -1
			}

			return (
				(existingSortOrder.get(a.id) ?? 0) - (existingSortOrder.get(b.id) ?? 0)
			)
		})

		sortedCases.forEach((testCase) => {
			sortOrder.set(testCase.id, sortIndex)
			sortIndex++
		})
	}

	return sortOrder
}

export type { PlanLink, RunLink, ReportLink, CaseGroup, CaseGroupLink }
