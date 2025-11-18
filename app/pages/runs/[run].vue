<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import BaseCard from "~/components/cards/BaseCard.vue"

const urlRun = useRoute().params.run as string

const supabase = useSupabaseClient<Database>()

type Run = Tables<"test_runs">
type RunCase = Tables<"test_cases">
type RunGroup = Tables<"test_run_groups">

interface RunCaseWithResult extends RunCase {
	result: string | null
}

const run = ref<Run>()
const runCases = ref<RunCaseWithResult[]>([])
const runGroup = ref<RunGroup>()

const statusStats = ref<{ title: string; value: string; number: number }[]>([
	{ title: "Total", value: "total", number: 0 },
	{ title: "Passed", value: "passed", number: 0 },
	{ title: "Failed", value: "failed", number: 0 },
	{ title: "Blocked", value: "blocked", number: 0 },
	{ title: "Skipped", value: "skipped", number: 0 },
	{ title: "Not Run", value: "not_run", number: 0 }
])

async function getRun() {
	const { data, error } = await supabase
		.from("test_runs")
		.select("*")
		.eq("id", urlRun)
	if (error) {
		console.error(error)
		return
	}
	run.value = data[0]

	const { data: runGroupData, error: runGroupError } = await supabase
		.from("test_run_groups")
		.select("*")
		.eq("id", run.value?.group || "")
	if (runGroupError) {
		console.error(runGroupError)
		return
	}
	runGroup.value = runGroupData[0] || undefined
}

async function getRunCases() {
	if (!run.value) {
		console.error("Run not selected")
		return
	}
	// table test_runs contains run id
	// table test_run_case_links contains test run id and test case ids

	const { data: runCasesDb, error: runCasesError } = await supabase
		.from("test_run_case_links")
		.select("case_id, result")
		.eq("run_id", run.value.id)
	if (runCasesError) {
		console.error(runCasesError)
		return
	}

	// get test cases
	const { data: cases, error: casesError } = await supabase
		.from("test_cases")
		.select("*")
		.in(
			"id",
			runCasesDb.map((c) => c.case_id)
		)
	if (casesError) {
		console.error(casesError)
		return
	}

	// Merge cases with their results
	runCases.value = cases.map((testCase) => {
		const linkData = runCasesDb.find((link) => link.case_id === testCase.id)
		return {
			...testCase,
			result: linkData?.result || null
		}
	})
	updateStatusStats()
}

async function updateCaseResult(caseId: string, resultValue: string) {
	if (!run.value) return

	const { error } = await supabase
		.from("test_run_case_links")
		.update({ result: resultValue })
		.eq("run_id", run.value.id)
		.eq("case_id", caseId)

	updateStatusStats()

	if (error) {
		console.error("Error updating result:", error)
	}
}

function updateStatusStats() {
	// Calculate status stats
	statusStats.value.forEach((s) => {
		s.number = runCases.value.filter((c) => c.result === s.value).length
	})
	statusStats.value.find((s) => s.value === "total")!.number =
		runCases.value.length
}

const resultTypes = [
	{
		label: "Not Run",
		value: "not_run",
		textColor: "text-neutral-400",
		bgColor: "bg-neutral-500/20",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-dot-dashed"
	},
	{
		label: "Passed",
		value: "passed",
		textColor: "text-lime-400",
		bgColor: "bg-lime-500/20",
		hoverBgColor: "hover:bg-lime-500/30",
		outlineColor: "outline-lime-500/50",
		icon: "i-lucide-circle-check"
	},
	{
		label: "Failed",
		value: "failed",
		textColor: "text-red-400",
		bgColor: "bg-red-500/20",
		hoverBgColor: "hover:bg-red-500/30",
		outlineColor: "outline-red-500/50",
		icon: "i-lucide-circle-x"
	},
	{
		label: "Blocked",
		value: "blocked",
		textColor: "text-yellow-400",
		bgColor: "bg-yellow-500/20",
		hoverBgColor: "hover:bg-yellow-500/30",
		outlineColor: "outline-yellow-500/50",
		icon: "i-lucide-circle-alert"
	},
	{
		label: "Skipped",
		value: "skipped",
		textColor: "text-neutral-200",
		bgColor: "stripe-gradient",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-arrow-right"
	}
]

function getResultType(resultValue: string | null) {
	const result = resultTypes.find((r) => r.value === resultValue)
	return result || resultTypes[0]!
}

function getStatusStatsPercentage(value: string) {
	const valueStats = statusStats.value.find((s) => s.value === value)
	const totalStats = statusStats.value.find((s) => s.value === "total")

	if (!valueStats || !totalStats || totalStats.number === 0) {
		return 0
	}

	return (valueStats.number / totalStats.number) * 100
}

getRun().then(() => {
	getRunCases()
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Test Run</h1>
		<div v-if="run" class="flex flex-col lg:flex-row gap-8 w-full">
			<h1 class="text-3xl font-bold text-primary">
				{{ run?.title }}
			</h1>
			<NuxtLink
				v-if="runGroup"
				class="text-neutral-500 font-semibold flex items-center gap-2 hover:underline"
				:to="`/run-groups/${runGroup.id}`"
			>
				<UIcon name="i-lucide-library-big" class="h-4 w-4" />
				<span>{{ runGroup.title }}</span>
			</NuxtLink>
			<!-- <div class="md">
					<VueMarkdown
						v-if="run.description"
						:options="options"
						:source="runGroup.description"
					>
					</VueMarkdown>
				</div> -->
		</div>
		<div class="h-2 w-full rounded-full bg-neutral-500/20 flex overflow-hidden">
			<div
				class="h-full bg-lime-500 transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('passed')}%` }"
			></div>
			<div
				class="h-full bg-yellow-500 transition-all duration-200"
				:style="{
					width: `${getStatusStatsPercentage('blocked')}%`
				}"
			></div>
			<div
				class="h-full bg-red-500 transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('failed')}%` }"
			></div>
			<div
				class="h-full transition-all duration-200 stripe-gradient"
				:style="{
					width: `${getStatusStatsPercentage('skipped')}%`
				}"
			></div>
			<div
				class="h-full bg-transparent transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('not_run')}%` }"
			></div>
		</div>
		<div class="text-sm text-neutral-400 flex gap-4">
			<div
				v-for="item in statusStats.filter((s) => s.value !== 'total')"
				:key="item.value"
				class="flex gap-1"
			>
				<UBadge
					:ui="{
						base: `${getResultType(item.value).bgColor} ${getResultType(item.value).textColor} rounded-full`
					}"
					>{{ item.title }}</UBadge
				>
				<span class="text-neutral-400">{{ item.number }}</span>
				<span class="text-neutral-400"
					>({{ getStatusStatsPercentage(item.value) }}%)</span
				>
			</div>
		</div>
		<USeparator />
		<div class="flex flex-col gap-y-3">
			<BaseCard v-for="item in runCases" :key="item.id">
				<template #default>
					<div class="grid grid-cols-6">
						<div class="col-span-2 font-bold">
							{{ item.title }}
						</div>
						<div class="w-full">
							<USelectMenu
								:model-value="getResultType(item.result)"
								:items="resultTypes"
								variant="none"
								:ui="{
									// it's impressive that I can get this low into it but damn
									base: `relative *:flex *:items-center *:gap-2 w-36 px-2 py-1 rounded-full ${getResultType(item.result).textColor} ${getResultType(item.result).bgColor} ${getResultType(item.result).outlineColor} ${getResultType(item.result).hoverBgColor}`,
									trailingIcon: `group-data-[state=open]:rotate-180 transition-transform duration-200 ${getResultType(item.result).textColor}`,
									item: `data-highlighted:not-data-disabled:before:bg-transparent`
								}"
								@update:model-value="
									(newResult) => {
										item.result = newResult.value
										updateCaseResult(item.id, newResult.value)
									}
								"
							>
								<template #default>
									<div :class="`font-semibold text-sm`">
										<UIcon :name="getResultType(item.result).icon" />
										{{ getResultType(item.result).label }}
									</div>
								</template>
								<template #item="{ item: resultItem }">
									<div
										:class="
											`font-semibold text-sm ${resultItem.textColor} flex items-center w-full flex-nowrap
										gap-2 ${resultItem.bgColor} ${resultItem.hoverBgColor} backdrop-opacity-10 px-2 py-1 rounded-full cursor-pointer` +
											(resultItem.value === getResultType(item.result).value
												? ` outline-2 ${resultItem.outlineColor}`
												: '')
										"
									>
										<UIcon :name="resultItem.icon" class="h-4 w-4 shrink" />
										<div class="whitespace-nowrap">{{ resultItem.label }}</div>
									</div>
								</template>
							</USelectMenu>
						</div>
					</div>
				</template>
			</BaseCard>
		</div>
	</div>
</template>
