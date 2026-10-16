import assert from "node:assert/strict"
import { test } from "node:test"
import { calculateReportOutcome } from "./calculateReportOutcome.ts"

const caseResult = (priority, result) => ({ priority, result })
const passed = caseResult("high", "passed")

test("requires a High or Medium pass", () => {
	for (const cases of [
		[],
		[caseResult("low", "passed")],
		[caseResult("high", "skipped")]
	]) {
		assert.equal(calculateReportOutcome(cases).pass, false)
	}
})

test("High failures and three Medium failures fail", () => {
	assert.equal(
		calculateReportOutcome([passed, caseResult("high", "blocked")]).pass,
		false
	)
	assert.equal(
		calculateReportOutcome([
			passed,
			...Array(3).fill(caseResult("medium", "failed"))
		]).pass,
		false
	)
	assert.equal(
		calculateReportOutcome([
			passed,
			...Array(2).fill(caseResult("medium", "failed"))
		]).pass,
		true
	)
})

test("unfinished High or Medium cases prevent Passed; Low failures do not", () => {
	assert.equal(
		calculateReportOutcome([passed, caseResult(null, "not_run")]).pass,
		false
	)
	assert.equal(
		calculateReportOutcome([passed, caseResult("high", null)]).pass,
		false
	)
	assert.equal(
		calculateReportOutcome([passed, caseResult("low", "blocked")]).pass,
		true
	)
	assert.equal(
		calculateReportOutcome([passed, caseResult("low", "not_run")]).pass,
		true
	)
	assert.equal(
		calculateReportOutcome([passed, caseResult("medium", "skipped")]).pass,
		true
	)
})
