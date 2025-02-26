<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const urlRun = useRoute().params.run as string

const supabase = useSupabaseClient<Database>()

type Run = Tables<"test_runs">
type RunCase = Tables<"test_cases">

const run = ref<Run>()
const runCases = ref<RunCase[]>([])

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
}

async function getRunCases() {
	if (!run.value) {
		console.error("Run not selected")
		return
	}
	// table test_runs contains run id and test plan id
	// table test_plan_case_links contains test plan id and test case ids

	const { data: runCasesDb, error: runCasesError } = await supabase
		.from("test_plan_case_links")
		.select("case")
		.eq("plan", run.value.plan as string)
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
			runCasesDb.map((c) => c.case)
		)
	if (casesError) {
		console.error(casesError)
		return
	}

	runCases.value = cases || []
}

const resultTypes = [
	{
		label: "Not Run",
		value: "not_run",
		color: "gray",
		icon: "i-lucide-circle-dot-dashed"
	},
	{
		label: "Passed",
		value: "passed",
		color: "lime",
		icon: "i-lucide-circle-check"
	},
	{
		label: "Failed",
		value: "failed",
		color: "red",
		icon: "i-lucide-circle-x"
	},
	{
		label: "Blocked",
		value: "blocked",
		color: "yellow",
		icon: "i-lucide-circle-alert"
	},
	{
		label: "Skipped",
		value: "skipped",
		color: "gray",
		icon: "i-lucide-circle-arrow-right"
	}
]

const selectedResult = ref(resultTypes[0])

getRun().then(() => {
	getRunCases()
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Test Run</h1>
		<div class="flex flex-col lg:flex-row gap-3 w-full">
			<div v-if="run">
				<h1 class="text-3xl font-bold text-primary mb-8">
					{{ run?.title }}
				</h1>
				<!-- <div class="md">
					<VueMarkdown
						v-if="run.description"
						:options="options"
						:source="runGroup.description"
					>
					</VueMarkdown>
				</div> -->
			</div>
		</div>
		<UDivider />
		<div class="flex flex-col gap-y-3">
			<UCard
				v-for="item in runCases"
				:key="item.id"
				:ui="{
					header: { padding: 'px-4 py-3 sm:p-4' },
					body: { padding: 'px-4 py-3 sm:p-4' },
					footer: { padding: 'px-4 py-3 sm:p-4' }
				}"
			>
				<template #default>
					<div class="grid grid-cols-6">
						<div class="col-span-2 font-bold text-primary">
							{{ item.title }}
						</div>
						<div>
							<USelectMenu
								v-model="selectedResult"
								:options="resultTypes"
								variant="none"
								:ui="{
									wrapper: 'relative'
								}"
								:ui-menu="{
									background: 'bg-gray-800',
									option: {
										base: 'w-full',
										selected: 'pe-0',
										selectedIcon: {
											base: 'hidden'
										}
									}
								}"
							>
								<template #default>
									<div
										:class="`font-semibold text-sm text-${selectedResult.color}-400 flex items-center 
										gap-2 bg-${selectedResult.color}-500 bg-opacity-20 px-2 py-1 rounded-full w-full`"
									>
										<UIcon :name="selectedResult.icon" />
										{{ selectedResult.label }}
									</div>
								</template>
								<template #option="{ option }">
									<div
										:class="`font-semibold text-sm text-${option.color}-400 flex items-center w-full 
										gap-2 bg-${option.color}-500 bg-opacity-10 px-2 py-1 rounded-full`"
									>
										<UIcon :name="option.icon" class="h-4 w-4 flex-shrink" />
										<div class="whitespace-nowrap">{{ option.label }}</div>
									</div>
								</template>
							</USelectMenu>
						</div>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
