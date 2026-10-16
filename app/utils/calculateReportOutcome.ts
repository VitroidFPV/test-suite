import type { ResultType } from "~/types/resultTypes"
import type { Database } from "~/types/database.types"

export type CasePriority = Database["public"]["Enums"]["priority_string"]

export type OutcomeCase = {
	priority: CasePriority | null
	result: ResultType | null
}

export function calculateReportOutcome(cases: OutcomeCase[]) {
	const failures = (priority: CasePriority) =>
		cases.filter(
			(testCase) =>
				(testCase.priority ?? "medium") === priority &&
				(testCase.result === "failed" || testCase.result === "blocked")
		).length
	const highFailures = failures("high")
	const mediumFailures = failures("medium")
	const lowFailures = failures("low")
	const unfinished = cases.filter(
		(testCase) =>
			(testCase.priority ?? "medium") !== "low" &&
			(!testCase.result || testCase.result === "not_run")
	).length
	const passed = cases.some(
		(testCase) =>
			(testCase.priority ?? "medium") !== "low" && testCase.result === "passed"
	)

	const reasons: string[] = []
	if (highFailures)
		reasons.push(
			`${highFailures} High case${highFailures === 1 ? "" : "s"} failed or blocked`
		)
	if (mediumFailures >= 3)
		reasons.push(`${mediumFailures} Medium cases failed or blocked`)
	if (unfinished)
		reasons.push(
			`${unfinished} High or Medium case${unfinished === 1 ? "" : "s"} not run`
		)
	if (!passed) reasons.push("No High or Medium case passed")

	const pass = reasons.length === 0
	if (pass) {
		reasons.push("A High or Medium case passed")
		if (mediumFailures)
			reasons.push(
				`${mediumFailures} Medium failure${mediumFailures === 1 ? "" : "s"} tolerated`
			)
	}
	if (lowFailures)
		reasons.push(
			`${lowFailures} Low failure${lowFailures === 1 ? "" : "s"} for review`
		)

	return {
		pass,
		reason: reasons.join("; ")
	}
}
