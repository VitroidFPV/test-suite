export const RESULT_VALUES = [
	"not_run",
	"passed",
	"failed",
	"blocked",
	"skipped"
] as const
export type ResultType = (typeof RESULT_VALUES)[number]
