<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCard from "~/components/cards/TestRunCard.vue"
import BaseCard from "~/components/cards/BaseCard.vue"

import { fetchRunsWithUsers } from "~/composables/fetchRunsWithUsers"

const toast = useToast()

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

type Run = Tables<"test_runs">
type NewRun = Run
type TestPlan = Tables<"test_plans">

type TestPlanWithLabel = Omit<TestPlan, "description"> & {
	label: string
	description: string | undefined
}
type RunGroupWithLabel = Omit<RunGroup, "description"> & {
	label: string
	description: string | undefined
}

const {
	data: runs,
	error: runsError,
	refresh: refreshRuns
} = await useAsyncData("runs", async () => await fetchRunsWithUsers(supabase))

const {
	data: testPlans,
	error: testPlansError,
	refresh: refreshTestPlans
} = await useAsyncData(
	"testPlans",
	async () => {
		const { data, error } = await supabase.from("test_plans").select("*")
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

const {
	data: runGroups,
	error: runGroupsError,
	refresh: refreshRunGroups
} = await useAsyncData(
	"runGroups",
	async () => {
		const { data, error } = await supabase.from("test_run_groups").select("*")
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (runsError.value) errors.push(runsError.value)
	if (testPlansError.value) errors.push(testPlansError.value)
	if (runGroupsError.value) errors.push(runGroupsError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([refreshRuns(), refreshTestPlans(), refreshRunGroups()])
}

const selectedRunGroup = ref<RunGroupWithLabel>()
const selectedTestPlan = ref<TestPlanWithLabel>()

const transformedTestPlans = computed(() =>
	(testPlans.value ?? []).map((plan) => ({
		...plan,
		label: plan.title || "",
		description: plan.description ?? undefined
	}))
)

const transformedRunGroups = computed(() =>
	(runGroups.value ?? []).map((group) => ({
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
	plan: null
})

function selectGroup(group: RunGroupWithLabel) {
	selectedRunGroup.value = group
}

async function selectPlan(plan: TestPlanWithLabel) {
	newRun.value.plan = plan.id
}

function autoFill() {
	newRun.value.title = `${selectedRunGroup.value?.title} - ${selectedTestPlan.value?.title}`
}

const createRunModalOpen = ref(false)

async function createRun() {
	const { error } = await supabase.from("test_runs").insert([newRun.value])
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
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
			toast.add({
				title: "Error",
				description: groupLinkError.message,
				color: "error"
			})
			return
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
			toast.add({
				title: "Error",
				description: planCasesError.message,
				color: "error"
			})
			return
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
				toast.add({
					title: "Error",
					description: linkError.message,
					color: "error"
				})
				return
			}
		}
	}

	createRunModalOpen.value = false

	// Reset form state for next run creation
	newRun.value = {
		id: crypto.randomUUID(),
		title: "",
		created_at: new Date().toISOString(),
		created_by: user.value?.id || "",
		plan: null
	}
	selectedRunGroup.value = undefined
	selectedTestPlan.value = undefined

	await refreshRuns()
}

useHead({
	title: `Test Runs | Test Suite`
})

defineShortcuts({
	shift_a: {
		handler: () => {
			if (testPlans.value && runGroups.value) {
				createRunModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Test Runs"
		:error="pageError"
		@retry="retryAll"
	>
		<template #title-trailing>
			<UModal
				v-model:open="createRunModalOpen"
				title="Create Run"
				description="Create a new test run with a title, group and plan"
				:ui="{
					title: 'text-primary'
				}"
			>
				<UTooltip text="Create Test Run" :kbds="['shift', 'A']">
					<UButton
						color="primary"
						size="sm"
						variant="soft"
						icon="i-lucide-plus"
						:disabled="!testPlans || !runGroups"
					>
						New Test Run
					</UButton>
				</UTooltip>

				<template #body>
					<div class="flex flex-col gap-3">
						<UFieldGroup class="w-full">
							<UInput
								v-model="newRun.title!"
								placeholder="Run Title"
								color="neutral"
								class="w-full"
							/>
							<UTooltip text="Automatic Fill (requires Plan and Group)">
								<UButton
									color="primary"
									icon="i-lucide-pencil"
									:disabled="!selectedRunGroup || !selectedTestPlan"
									@click="autoFill"
								/>
							</UTooltip>
						</UFieldGroup>
						<div class="flex gap-x-3">
							<div class="flex flex-col gap-y-2 w-full">
								<div class="flex items-center gap-x-1 text-neutral-400 text-sm">
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
											{{ item.label }}
										</div>
									</template>
								</USelectMenu>
							</div>
							<USeparator orientation="vertical" />
							<div class="flex flex-col gap-y-2 w-full">
								<div class="flex items-center gap-x-1 text-neutral-400 text-sm">
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
											{{ item.label }}
										</div>
									</template>
								</USelectMenu>
							</div>
						</div>
					</div>
				</template>
				<template #footer>
					<div class="flex gap-3 justify-end w-full">
						<UButton
							color="primary"
							size="sm"
							variant="soft"
							icon="i-lucide-plus"
							:disabled="!newRun.title"
							loading-auto
							@click="createRun"
						>
							Create Run
						</UButton>
					</div>
				</template>
			</UModal>
		</template>
		<template #content>
			<div
				v-if="runs && runs.length > 0"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<TestRunCard v-for="item in runs" :key="item.id" :run="item" />
			</div>
			<div
				v-else-if="!runs"
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
					</BaseCard>
				</div>
			</div>
			<div v-else class="text-neutral-500">
				No test runs yet. Click "New Test Run" to create one.
			</div>
		</template>
	</PageWrapper>
</template>
