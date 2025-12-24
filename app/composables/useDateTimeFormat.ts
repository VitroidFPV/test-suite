/**
 * Composable that provides consistent date/time formatting options
 * for use with NuxtTime component throughout the app.
 */
export function useDateTimeFormat() {
	const dateTimeProps = {
		locale: "de-DE",
		day: "numeric",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	} as const

	return {
		dateTimeProps
	}
}
