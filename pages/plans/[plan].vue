<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import type Options from "vue-markdown-render"
import VueMarkdown from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const supabase = useSupabaseClient<Database>()

type TestPlan = Tables<"test_plans">
type TestPlanCase = Tables<"test_plan_case_links">
type TestCase = Tables<"test_cases">

const plan = ref<TestPlan>()
const planCases = ref<TestPlanCase[]>([])
const cases = ref<TestCase[]>([])

const urlPlan = useRoute().params.plan

// get plan from url
async function getPlan() {
	const { data, error } = await supabase
		.from("test_plans")
		.select("*")
		.eq("id", urlPlan)
	if (error) {
		console.error(error)
		return
	}
	plan.value = data[0]
	// console.log(plan.value)

	useHead({
		title: `${plan.value?.title} | Test Plans | Test Suite`
	})
}

// get plan cases
async function getPlanCases() {
	const { data, error } = await supabase
		.from("test_plan_case_links")
		.select("*")
		.eq("plan", urlPlan)
	if (error) {
		console.error(error)
		return
	}
	planCases.value = data
	// console.log(planCases.value)

	const caseIds = planCases.value.map((link) => link.case)

	const { data: casesData, error: casesError } = await supabase
		.from("test_cases")
		.select("*")
		.in("id", caseIds)
	if (casesError) {
		console.error(casesError)
		return
	}
	cases.value = casesData
	console.log(cases.value)
}

getPlan()
getPlanCases()
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Test Plan</h1>
		<div class="flex flex-col lg:flex-row gap-3 w-full">
			<div v-if="plan">
				<h1 class="text-6xl font-bold text-primary mb-8">
					{{ plan?.title }}
				</h1>
				<div class="md">
					<VueMarkdown
						v-if="plan.description"
						:options="options"
						:source="plan.description"
					>
					</VueMarkdown>
				</div>
			</div>
		</div>
		<UDivider />
		<div
			v-if="planCases.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="item in cases" :key="item.id">
				<UCard
					:ui="{
						header: { padding: 'px-4 py-3 sm:p-4' },
						body: { padding: 'px-4 py-3 sm:p-4' },
						footer: { padding: 'px-4 py-3 sm:p-4' }
					}"
				>
					<template #header>
						<div class="font-bold text-primary-500">
							{{ item.title }}
						</div>
					</template>
					<template #default>
						<span v-if="item.text" class="line-clamp-1 text-ellipsis">{{
							item.text
						}}</span>
						<div v-else class="opacity-50">No description</div>
					</template>
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-gray-500">
								{{ dayjs(item.created_at).format("D.MM.YYYY HH:mm") }}
							</div>
							<div class="flex items-center gap-2">
								<UButton
									color="primary"
									size="2xs"
									variant="link"
									icon="i-lucide-pencil"
									@click="caseModal(item.id)"
								/>
							</div>
						</div>
					</template> -->
				</UCard>
			</div>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="i in 3" :key="i">
				<UCard
					:ui="{
						header: { padding: 'px-4 py-3 sm:p-4' },
						body: { padding: 'px-4 py-3 sm:p-4' },
						footer: { padding: 'px-4 py-3 sm:p-4' }
					}"
					:style="{
						opacity: 1 - i / 10
					}"
				>
					<template #header>
						<div class="font-bold text-primary-500">
							<USkeleton class="w-1/2 h-6" />
						</div>
					</template>
					<template #default>
						<span class="line-clamp-1 text-ellipsis">
							<USkeleton class="h-6 w-full" />
						</span>
					</template>
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-gray-500">
								<USkeleton class="w-1/2 h-6" />
							</div>
							<div class="flex items-center gap-2">
								<USkeleton width="w-1/2 h-6" />
							</div>
						</div>
					</template> -->
				</UCard>
			</div>
		</div>
	</div>
</template>
