<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCard from "~/components/cards/TestRunCard.vue"
import BaseCard from "~/components/cards/BaseCard.vue"

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

type Run = Tables<"test_runs">
type NewRun = Run
type TestPlan = Tables<"test_plans">
type UserMetadata = Tables<"user_metadata">

type TestPlanWithLabel = Omit<TestPlan, "description"> & {
	label: string
	description: string | undefined
}
type RunGroupWithLabel = Omit<RunGroup, "description"> & {
	label: string
	description: string | undefined
}
type RunWithUser = Run & { creator?: UserMetadata }

const runs = ref<RunWithUser[]>([])
const testPlans = ref<TestPlan[]>([])
const runGroups = ref<RunGroup[]>([])

async function getRuns() {
	const { data: runsData, error: runsError } = await supabase
		.from("test_runs")
		.select("*")

	if (runsError) {
		console.error(runsError)
		return
	}

	const runsArray = runsData || []

	// Get unique creator IDs
	const creatorIds = [
		...new Set(
			runsArray.filter((run) => run.created_by).map((run) => run.created_by)
		)
	]

	if (creatorIds.length > 0) {
		// Fetch user metadata for all creators
		const { data: usersData, error: usersError } = await supabase
			.from("user_metadata")
			.select("*")
			.in(
				"id",
				creatorIds.filter((id): id is string => id !== null)
			)

		if (usersError) {
			console.error(usersError)
			runs.value = runsArray
			return
		}

		// Map users to their respective runs
		const runsWithUsers = runsArray.map((run) => {
			const creator = usersData?.find((user) => user.id === run.created_by)
			return {
				...run,
				creator
			}
		})

		runs.value = runsWithUsers
	} else {
		runs.value = runsArray
	}
}

const selectedRunGroup = ref<RunGroupWithLabel>()
const selectedTestPlan = ref<TestPlanWithLabel>()

const transformedTestPlans = computed(() =>
	testPlans.value.map((plan) => ({
		...plan,
		label: plan.title || "",
		description: plan.description ?? undefined
	}))
)

const transformedRunGroups = computed(() =>
	runGroups.value.map((group) => ({
		...group,
		label: group.title || "",
		description: group.description ?? undefined
	}))
)

const user = useSupabaseUser()

const newRun = ref<NewRun>({
	id: crypto.randomUUID(),
	title: "",
	created_at: new Date().toISOString(),
	created_by: user.value?.id || "",
	plan: ""
})

function selectGroup(group: RunGroupWithLabel) {
	selectedRunGroup.value = group
	console.log(newRun.value)
}

async function selectPlan(plan: TestPlanWithLabel) {
	newRun.value.plan = plan.id
	console.log(newRun.value)
}

function autoFill() {
	newRun.value.title = `${selectedRunGroup.value?.title} - ${selectedTestPlan.value?.title}`
}

async function getRunGroups() {
	const { data, error } = await supabase.from("test_run_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	runGroups.value = data || []

	console.log(runGroups.value)
}

async function getTestPlans() {
	const { data, error } = await supabase.from("test_plans").select("*")
	if (error) {
		console.error(error)
		return
	}
	testPlans.value = data || []
}

getRuns()
getRunGroups()
getTestPlans()

const createRunModalOpen = ref(false)

function openCreateRunModal() {
	createRunModalOpen.value = true
}

async function createRun() {
	const { error } = await supabase.from("test_runs").insert([newRun.value])
	if (error) {
		console.error(error)
		return
	}

	// Link run to group
	if (selectedRunGroup.value?.id) {
		const { error: groupLinkError } = await supabase
			.from("test_run_group_links")
			.insert([
				{
					run: newRun.value.id,
					group: selectedRunGroup.value.id
				}
			])

		if (groupLinkError) {
			console.error("Error linking run to group:", groupLinkError)
		}
	}

	// Get test cases from the selected plan
	if (newRun.value.plan) {
		const { data: planCases, error: planCasesError } = await supabase
			.from("test_plan_case_links")
			.select("case")
			.eq("plan", newRun.value.plan)

		if (planCasesError) {
			console.error("Error fetching plan cases:", planCasesError)
		} else if (planCases && planCases.length > 0) {
			// Create run-case links for each case in the plan
			const runCaseLinks = planCases.map((link) => ({
				run: newRun.value.id,
				case: link.case,
				result: "not_run" as
					| "not_run"
					| "passed"
					| "failed"
					| "blocked"
					| "skipped"
			}))

			const { error: linkError } = await supabase
				.from("test_run_case_links")
				.insert(runCaseLinks)

			if (linkError) {
				console.error("Error creating run-case links:", linkError)
			}
		}
	}

	createRunModalOpen.value = false

	getRuns()
}

useHead({
	title: `Test Runs | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex w-full justify-between">
			<h1 class="text-3xl font-bold text-primary">Test Runs</h1>
			<div class="flex flex-col">
				<UButton
					color="primary"
					size="sm"
					variant="solid"
					icon="i-lucide-plus"
					@click="openCreateRunModal"
				>
					New Test Run
				</UButton>
			</div>
		</div>

		<!-- <USeparator /> -->

		<div
			v-if="runs.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<TestRunCard v-for="item in runs" :key="item.id" :run="item" />
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="i in 3" :key="i">
				<BaseCard
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
				</BaseCard>
			</div>
		</div>

		<UModal
			v-model:open="createRunModalOpen"
			:ui="{
				body: 'max-w-full! 2xl:mx-64 xl:mx-32 lg:mx-32 md:mx-16 mx-0 sm:mx-8'
			}"
		>
			<template #title>Create Run</template>
			<template #description>
				Create a new test run with a title, group and plan
			</template>
			<template #content>
				<BaseCard>
					<template #header>
						<div class="flex flex-col gap-y-3">
							<UFieldGroup>
								<UInput
									v-model="newRun.title!"
									placeholder="Run Title"
									color="neutral"
									class="w-full"
								/>
								<UTooltip text="Automatic Fill (requires Plan and Group)">
									<UButton
										color="neutral"
										icon="i-lucide-pencil"
										:disabled="!selectedRunGroup || !selectedTestPlan"
										@click="autoFill"
									/>
								</UTooltip>
							</UFieldGroup>
							<div class="flex gap-x-3">
								<div class="flex flex-col gap-y-2 w-full">
									<div
										class="flex items-center gap-x-1 text-neutral-400 text-sm"
									>
										<UIcon name="i-lucide-book-check" class="h-4 w-4" />
										Test Plan
									</div>
									<USelectMenu
										v-model="selectedTestPlan"
										searchable
										search-placeholder="Search for a plan"
										placeholder="Select a plan"
										:items="transformedTestPlans"
										class="w-full relative"
										option-attribute="label"
										@change="selectedTestPlan && selectPlan(selectedTestPlan)"
									>
										<template #item="{ item }">
											<div class="flex items-center gap-2">
												<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
												{{ item.label }}
											</div>
										</template>
									</USelectMenu>
								</div>
								<USeparator orientation="vertical" />
								<div class="flex flex-col gap-y-2 w-full">
									<div
										class="flex items-center gap-x-1 text-neutral-400 text-sm"
									>
										<UIcon name="i-lucide-library-big" class="h-4 w-4" />
										Run Group
									</div>
									<USelectMenu
										v-model="selectedRunGroup"
										searchable
										search-placeholder="Search for a group"
										placeholder="Select a group"
										:items="transformedRunGroups"
										class="w-full relative"
										option-attribute="label"
										@change="selectedRunGroup && selectGroup(selectedRunGroup)"
									>
										<template #item="{ item }">
											<div class="flex items-center gap-2">
												<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
												{{ item.label }}
											</div>
										</template>
									</USelectMenu>
								</div>
							</div>
						</div>
					</template>
					<template #default>
						<!-- grid of all case titles -->
						<div class="flex flex-col gap-y-3">
							<div class="flex flex-col gap-y-3">
								<div class="font-bold text-primary-500 flex items-center gap-2">
									<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
									<!-- {{ group.group }} -->
								</div>
								<div
									class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
								>
									<!-- <UCard
										v-for="item in group.cases"
										:key="item.id"
										:ui="{
											header: { padding: 'px-4 py-3 sm:p-4' },
											body: { padding: 'px-4 py-3 sm:p-4' },
											footer: { padding: 'px-4 py-3 sm:p-4' },
											base: 'h-full outline outline-2 outline-transparent duration-100'
										}"
										:class="{
											'outline-primary-500/50': selectedCases.includes(item.id)
										}"
										@click="selectCase(item.id)"
									>
										{{ item.title }}
									</UCard> -->
								</div>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex items-center gap-2 h-fit w-full justify-end">
							<UButton
								color="primary"
								size="sm"
								variant="solid"
								icon="i-lucide-plus"
								@click="createRun"
							>
								Create Run
							</UButton>
						</div>
					</template>
				</BaseCard>
			</template>
		</UModal>
	</div>
</template>
