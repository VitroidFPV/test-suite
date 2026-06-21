export type ListControlOption = {
	label: string
	value: string
}

export type ListSortOrder = "asc" | "desc"

export type ListSection<T> = {
	label: string
	sortValue: unknown
	items: T[]
}

export type ListGroupLabel =
	| string
	| {
			label: string
			sortValue?: unknown
	  }

export function compareListValues(
	aValue: unknown,
	bValue: unknown,
	sortOrder: string
) {
	const normalizedA = aValue ?? ""
	const normalizedB = bValue ?? ""

	let comparison = 0
	if (
		typeof normalizedA === "string" &&
		typeof normalizedB === "string" &&
		isDateString(normalizedA) &&
		isDateString(normalizedB)
	) {
		comparison =
			new Date(normalizedA).getTime() - new Date(normalizedB).getTime()
	} else if (
		typeof normalizedA === "string" &&
		typeof normalizedB === "string"
	) {
		comparison = normalizedA.localeCompare(normalizedB)
	} else if (
		typeof normalizedA === "number" &&
		typeof normalizedB === "number"
	) {
		comparison = normalizedA - normalizedB
	} else if (
		typeof normalizedA === "boolean" &&
		typeof normalizedB === "boolean"
	) {
		comparison = Number(normalizedA) - Number(normalizedB)
	}

	return sortOrder === "desc" ? -comparison : comparison
}

export function groupListItems<T>(
	items: T[],
	getLabels: (item: T) => ListGroupLabel | ListGroupLabel[]
): ListSection<T>[] {
	const sections: ListSection<T>[] = []
	const sectionMap = new Map<string, ListSection<T>>()

	for (const item of items) {
		const labels = [getLabels(item)].flat().filter(Boolean)
		const sectionLabels = labels.length > 0 ? labels : ["Unassigned"]

		for (const groupLabel of sectionLabels) {
			const label =
				typeof groupLabel === "string" ? groupLabel : groupLabel.label
			const sortValue =
				typeof groupLabel === "string"
					? groupLabel
					: (groupLabel.sortValue ?? groupLabel.label)
			let section = sectionMap.get(label)
			if (!section) {
				section = { label, sortValue, items: [] }
				sectionMap.set(label, section)
				sections.push(section)
			}
			section.items.push(item)
		}
	}

	return sections
}

export function sortListSections<T>(
	sections: ListSection<T>[],
	sortOrder: string
) {
	return [...sections].sort((a, b) =>
		compareListValues(a.sortValue, b.sortValue, sortOrder)
	)
}

export function formatCreatedDateGroup(createdAt: string) {
	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric"
	}).format(new Date(createdAt))
}

export function createdDateGroupLabel(createdAt: string): ListGroupLabel {
	const date = new Date(createdAt)
	const startOfDay = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate()
	)

	return {
		label: formatCreatedDateGroup(createdAt),
		sortValue: startOfDay.toISOString()
	}
}

export function listSortOrderIcon(sortOrder: ListSortOrder) {
	return sortOrder === "asc" ? "i-lucide-arrow-up" : "i-lucide-arrow-down"
}

function isDateString(value: string) {
	const timestamp = Date.parse(value)
	return !Number.isNaN(timestamp) && /^\d{4}-\d{2}-\d{2}/.test(value)
}
