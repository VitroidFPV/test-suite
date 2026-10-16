export function optionalExternalUrl(
	value: string | null
): string | null | undefined {
	const trimmed = value?.trim() ?? ""
	if (!trimmed) return null

	try {
		const url = new URL(trimmed)
		return url.protocol === "https:" ? url.toString() : undefined
	} catch {
		return undefined
	}
}
