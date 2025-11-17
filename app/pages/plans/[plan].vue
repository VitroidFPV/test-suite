<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import type Options from "vue-markdown-render"
import VueMarkdown from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const supabase = useSupabaseClient<Database>()

type TestPlan = Tables<"test_plans">
type TestPlanCase = Tables<"test_plan_case_links">
type TestCase = Tables<"test_cases">
type PlanGroup = Tables<"test_case_groups">

const plan = ref<TestPlan>()
const planCases = ref<TestPlanCase[]>([])
const cases = ref<TestCase[]>([])
const allCases = ref<TestCase[]>([])
const groupedCases = ref<{ group: string; cases: TestCase[] }[]>([])

const urlPlan = useRoute().params.plan as string

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

	planTitle.value = plan.value.title ?? ""
	planDescription.value = plan.value.description ?? ""
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

	selectedCases.value = caseIds
}

async function getAllCases() {
	const { data: casesData, error: casesError } = await supabase
		.from("test_cases")
		.select("*")

	if (casesError) {
		console.error(casesError)
		return
	}

	const { data: groupingsData, error: groupingsError } = await supabase
		.from("test_case_group_links")
		.select("*")

	if (groupingsError) {
		console.error(groupingsError)
		return
	}

	allCases.value = casesData

	// get groups from db
	const groupIds = groupingsData.map((link) => link.group)
	const { data: groupsData, error: groupsError } = await supabase
		.from("test_case_groups")
		.select("*")
		.in("id", groupIds)

	if (groupsError) {
		console.error(groupsError)
		return
	}

	// group cases by group
	groupedCases.value = groupsData.map((group) => ({
		group: group.title,
		cases: casesData.filter((c) =>
			groupingsData
				.filter((link) => link.group === group.id)
				.map((link) => link.case)
				.includes(c.id)
		)
	}))

	console.log(allCases.value)
	console.log(groupedCases.value)
}

const planCaseModalOpen = ref(false)

function planCaseModal() {
	planCaseModalOpen.value = true
}

// selected cases as an array of uids
const selectedCases = ref<string[]>([])
const planTitle = ref("")
const planDescription = ref("")

function selectCase(id: string) {
	if (selectedCases.value.includes(id)) {
		selectedCases.value = selectedCases.value.filter((i) => i !== id)
	} else {
		selectedCases.value = [...selectedCases.value, id]
	}
}

// write selected cases to plan
async function savePlan() {
	const { error } = await supabase
		.from("test_plan_case_links")
		.delete()
		.eq("plan", urlPlan)
	if (error) {
		console.error(error)
		return
	}

	const insertData = selectedCases.value.map((id) => ({
		plan: urlPlan,
		case: id
	}))

	const { error: insertDataError } = await supabase
		.from("test_plan_case_links")
		.insert(insertData)
	if (insertDataError) {
		console.error(insertDataError)
		return
	}

	planCaseModalOpen.value = false

	// write plan title and description
	const { error: updateError } = await supabase
		.from("test_plans")
		.update({
			title: planTitle.value,
			description: planDescription.value
		})
		.eq("id", urlPlan)
	if (updateError) {
		console.error(updateError)
		return
	}

	getPlanCases()
	getPlan()
}

getPlan()
getPlanCases()
getAllCases()
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Test Plan</h1>
		<div class="flex w-full justify-between">
			<div class="flex flex-col gap-y-6">
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
			</div>
			<div class="flex flex-col">
				<UTooltip text="Add a case to this plan">
					<UButton
						color="primary"
						size="sm"
						variant="link"
						icon="i-lucide-pencil"
						@click="planCaseModal()"
					>
						Edit Plan
					</UButton>
				</UTooltip>
			</div>
		</div>

		<USeparator />

		<div class="w-full flex gap-x-3"></div>
		<div
			v-if="planCases.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="item in cases" :key="item.id">
				<UCard
					:ui="{
						header: 'px-4 py-3 sm:p-4',
						body: 'px-4 py-3 sm:p-4',
						footer: 'px-4 py-3 sm:p-4'
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
							<div class="text-sm text-neutral-500">
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
						header: 'px-4 py-3 sm:p-4',
						body: 'px-4 py-3 sm:p-4',
						footer: 'px-4 py-3 sm:p-4'
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
							<div class="text-sm text-neutral-500">
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

		<UModal
			v-model:open="planCaseModalOpen"
			:ui="{
				body: 'max-w-full! 2xl:mx-64 xl:mx-32 lg:mx-32 md:mx-16 mx-0 sm:mx-8'
			}"
		>
			<template #title>Edit Plan</template>
			<template #description>
				Edit the plan title, description and cases</template
			>
			<template #content>
				<UCard
					:ui="{
						header: 'px-4 py-3 sm:p-4',
						body: 'px-4 py-3 sm:p-4',
						footer: 'px-4 py-3 sm:p-4'
					}"
				>
					<template #header>
						<textarea
							v-if="plan"
							v-model="planTitle"
							placeholder="Group Title"
							color="primary"
							variant="none"
							class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal bg-neutral-800"
						/>
					</template>
					<template #default>
						<!-- grid of all case titles -->
						<div class="flex flex-col gap-y-3">
							<div
								v-for="group in groupedCases"
								:key="group.group"
								class="flex flex-col gap-y-3"
							>
								<div class="font-bold text-primary-500 flex items-center gap-2">
									<UIcon name="i-lucide-folder" class="h-4 w-4" />
									{{ group.group }}
								</div>
								<div
									class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
								>
									<UCard
										v-for="item in group.cases"
										:key="item.id"
										:ui="{
											header: 'px-4 py-3 sm:p-4',
											body: 'px-4 py-3 sm:p-4',
											footer: 'px-4 py-3 sm:p-4'
										}"
										:class="{
											'outline-primary-500/50': selectedCases.includes(item.id),
											'h-full outline outline-2 outline-transparent duration-100': true
										}"
										@click="selectCase(item.id)"
									>
										{{ item.title }}
									</UCard>
								</div>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex items-center justify-between">
							<UTooltip text="Delete" :shortcuts="['meta', 'Delete']">
								<UButton
									color="error"
									size="sm"
									variant="link"
									icon="i-lucide-trash"
								/>
							</UTooltip>
							<div class="flex items-center gap-2 h-fit">
								<UTooltip text="Save" :shortcuts="['meta', 'S']">
									<UButton
										color="primary"
										size="sm"
										variant="link"
										icon="i-lucide-save"
									/>
								</UTooltip>
								<UTooltip
									text="Save & Close"
									:shortcuts="['meta', 'Shift', 'S']"
								>
									<UButton
										color="primary"
										size="sm"
										variant="link"
										icon="i-lucide-save-all"
										@click="savePlan"
									/>
								</UTooltip>
							</div>
						</div>
					</template>
				</UCard>
			</template>
		</UModal>
	</div>
</template>
