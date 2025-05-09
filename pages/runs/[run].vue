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
		textColor: "text-neutral-400",
		bgColor: "bg-neutral-500/20",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
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
		<USeparator />
		<div class="flex flex-col gap-y-3">
			<UCard
				v-for="item in runCases"
				:key="item.id"
				:ui="{
					header: 'px-4 py-3 sm:p-4',
					body: 'px-4 py-3 sm:p-4',
					footer: 'px-4 py-3 sm:p-4'
				}"
			>
				<template #default>
					<div class="grid grid-cols-6">
						<div class="col-span-2 font-bold text-primary">
							{{ item.title }}
						</div>
						<div class="w-full">
							<USelectMenu
								v-model="selectedResult"
								:items="resultTypes"
								variant="none"
								:ui="{
									// it's impressive that I can get this low into it but damn
									base: `relative *:flex *:items-center *:gap-2 w-36 px-2 py-1 rounded-full ${selectedResult.textColor} ${selectedResult.bgColor} ${selectedResult.outlineColor} ${selectedResult.hoverBgColor}`,
									trailingIcon: `group-data-[state=open]:rotate-180 transition-transform duration-200 ${selectedResult.textColor}`,
									item: `data-highlighted:not-data-disabled:before:bg-transparent`
								}"
							>
								<template #default>
									<div :class="`font-semibold text-sm`">
										<UIcon :name="selectedResult.icon" />
										{{ selectedResult.label }}
									</div>
								</template>
								<template #item="{ item: resultItem }">
									<div
										:class="
											`font-semibold text-sm ${resultItem.textColor} flex items-center w-full flex-nowrap
										gap-2 ${resultItem.bgColor} ${resultItem.hoverBgColor} backdrop-opacity-10 px-2 py-1 rounded-full cursor-pointer` +
											(resultItem.value === selectedResult.value
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
			</UCard>
		</div>
	</div>
</template>
