<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import type { ResultType } from "~/types/resultTypes"
import TestRunCard from "~/components/cards/TestRunCard.vue"
import BaseCard from "~/components/cards/BaseCard.vue"
import type { ListControlOption, ListSortOrder } from "~/utils/listGrouping"

import { fetchRunsWithUsers } from "~/composables/fetchRunsWithUsers"
import { getOrderedPlanCaseIds } from "~/utils/planCaseOrdering"

const toast = useToast()

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

type Run = Tables<"test_runs">
type NewRun = Run
type TestPlan = Tables<"test_plans">
type UserMetadata = Tables<"user_metadata">
type RunWithUser = Run & { creator?: UserMetadata }
type RunWithListMetadata = RunWithUser & { runGroupTitles: string[] }

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
		const { data, error } = await supabase
			.from("test_plans")
			.select("*")
			.is("deleted_at", null)
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
		const { data, error } = await supabase
			.from("test_run_groups")
			.select("*")
			.is("deleted_at", null)
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

const {
	data: runGroupLinks,
	error: runGroupLinksError,
	refresh: refreshRunGroupLinks
} = await useAsyncData(
	"runGroupLinks",
	async () => {
		const { data, error } = await supabase
			.from("test_run_group_links")
			.select("run, group")
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
	if (runGroupLinksError.value) errors.push(runGroupLinksError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([
		refreshRuns(),
		refreshTestPlans(),
		refreshRunGroups(),
		refreshRunGroupLinks()
	])
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

const runGroupsByRunId = computed(() => {
	const groupsById = new Map(
		(runGroups.value ?? []).map((group) => [group.id, group])
	)
	const groupsByRunId = new Map<string, RunGroup[]>()

	for (const link of runGroupLinks.value ?? []) {
		const group = groupsById.get(link.group)
		if (!group) continue

		const groups = groupsByRunId.get(link.run) ?? []
		groups.push(group)
		groupsByRunId.set(link.run, groups)
	}

	return groupsByRunId
})

const runsWithListMetadata = computed<RunWithListMetadata[] | undefined>(() => {
	if (!runs.value) return undefined

	return (runs.value as RunWithUser[]).map((run) => ({
		...run,
		runGroupTitles: (runGroupsByRunId.value.get(run.id) ?? []).map(
			(group) => group.title
		)
	}))
})

const runListOptions = ref<ListControlOption[]>([
	{ label: "Created At", value: "created_at" },
	{ label: "Name", value: "title" },
	{ label: "Author", value: "created_by" },
	{ label: "Run Group", value: "run_group" }
])
const runGroupOptions = ref<ListControlOption[]>([
	{ label: "None", value: "none" },
	...runListOptions.value.filter((option) => option.value !== "title")
])
const runGroupBy = ref<ListControlOption>(runGroupOptions.value[0]!)
const runGroupSortOrder = ref<ListSortOrder>("asc")
const runSortBy = ref<ListControlOption>(runListOptions.value[0]!)
const runSortOrder = ref<ListSortOrder>("desc")

function getRunListValue(run: RunWithListMetadata, option: string) {
	if (option === "created_by") {
		return run.creator?.username ?? "Unknown user"
	}
	if (option === "run_group") {
		return run.runGroupTitles.join(", ")
	}
	return run[option as keyof RunWithListMetadata]
}

const sortedRuns = computed(() => {
	if (!runsWithListMetadata.value) return undefined

	return [...runsWithListMetadata.value].sort((a, b) =>
		compareListValues(
			getRunListValue(a, runSortBy.value.value),
			getRunListValue(b, runSortBy.value.value),
			runSortOrder.value
		)
	)
})

const groupedRuns = computed(() => {
	if (!sortedRuns.value) return undefined

	if (runGroupBy.value.value === "none") {
		return [{ label: "", sortValue: "", items: sortedRuns.value }]
	}

	if (runGroupBy.value.value === "created_at") {
		return sortListSections(
			groupListItems(sortedRuns.value, (run) =>
				createdDateGroupLabel(run.created_at)
			),
			runGroupSortOrder.value
		)
	}

	if (runGroupBy.value.value === "created_by") {
		return sortListSections(
			groupListItems(
				sortedRuns.value,
				(run) => run.creator?.username ?? "Unknown user"
			),
			runGroupSortOrder.value
		)
	}

	if (runGroupBy.value.value === "run_group") {
		return sortListSections(
			groupListItems(sortedRuns.value, (run) => run.runGroupTitles),
			runGroupSortOrder.value
		)
	}

	return [{ label: "", sortValue: "", items: sortedRuns.value }]
})

const user = useSupabaseUser()

const newRun = ref<NewRun>({
	id: crypto.randomUUID(),
	title: "",
	created_at: new Date().toISOString(),
	created_by: user.value?.id || "",
	deleted_at: null,
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

	// Get test cases from the selected plan in grouped display order
	if (newRun.value.plan) {
		const { data: planCaseLinks, error: planCasesError } = await supabase
			.from("test_plan_case_links")
			.select("case, sort_order")
			.eq("plan", newRun.value.plan)
			.order("sort_order", { ascending: true })

		if (planCasesError) {
			console.error("Error fetching plan cases:", planCasesError)
			toast.add({
				title: "Error",
				description: planCasesError.message,
				color: "error"
			})
			return
		} else if (planCaseLinks && planCaseLinks.length > 0) {
			const caseIds = planCaseLinks.map((link) => link.case)

			const { data: casesData, error: casesError } = await supabase
				.from("test_cases")
				.select("id")
				.in("id", caseIds)
				.is("deleted_at", null)

			if (casesError) {
				console.error("Error fetching plan case details:", casesError)
				toast.add({
					title: "Error",
					description: casesError.message,
					color: "error"
				})
				return
			}

			const { data: groupLinks, error: groupLinksError } = await supabase
				.from("test_case_group_links")
				.select("case, group")
				.in("case", caseIds)

			if (groupLinksError) {
				console.error("Error fetching case group links:", groupLinksError)
				toast.add({
					title: "Error",
					description: groupLinksError.message,
					color: "error"
				})
				return
			}

			const groupIds = [
				...new Set((groupLinks ?? []).map((link) => link.group))
			]

			const { data: groupsData, error: groupsError } =
				groupIds.length > 0
					? await supabase
							.from("test_case_groups")
							.select("id, title, name")
							.in("id", groupIds)
							.is("deleted_at", null)
					: { data: [], error: null }

			if (groupsError) {
				console.error("Error fetching case groups:", groupsError)
				toast.add({
					title: "Error",
					description: groupsError.message,
					color: "error"
				})
				return
			}

			const orderedCaseIds = getOrderedPlanCaseIds(
				casesData ?? [],
				groupsData ?? [],
				groupLinks ?? [],
				planCaseLinks
			)

			const runCaseLinks = orderedCaseIds.map((caseId, index) => ({
				run: newRun.value.id,
				case: caseId,
				result: "not_run" as ResultType,
				sort_order: index
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
		deleted_at: null,
		plan: null
	}
	selectedRunGroup.value = undefined
	selectedTestPlan.value = undefined

	await Promise.all([refreshRuns(), refreshRunGroupLinks()])
}

useStablePageTitle({
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
			<div v-if="runs && runs.length > 0" class="flex flex-col gap-4 w-full">
				<div class="flex flex-wrap items-center gap-2">
					<div class="text-sm text-neutral-500">Group by</div>
					<USelectMenu
						v-model="runGroupBy"
						:items="runGroupOptions"
						:ui="{ content: 'min-w-fit' }"
						class="w-36"
					/>
					<UTooltip
						:text="
							runGroupSortOrder === 'asc'
								? 'Sort groups ascending'
								: 'Sort groups descending'
						"
					>
						<UButton
							color="neutral"
							variant="ghost"
							size="sm"
							:disabled="runGroupBy.value === 'none'"
							:icon="listSortOrderIcon(runGroupSortOrder)"
							@click="
								runGroupSortOrder = runGroupSortOrder === 'asc' ? 'desc' : 'asc'
							"
						/>
					</UTooltip>
					<div class="text-sm text-neutral-500">Sort by</div>
					<USelectMenu
						v-model="runSortBy"
						:items="runListOptions"
						:ui="{ content: 'min-w-fit' }"
						class="w-36"
					/>
					<UTooltip
						:text="
							runSortOrder === 'asc'
								? 'Sort items ascending'
								: 'Sort items descending'
						"
					>
						<UButton
							color="neutral"
							variant="ghost"
							size="sm"
							:icon="listSortOrderIcon(runSortOrder)"
							@click="runSortOrder = runSortOrder === 'asc' ? 'desc' : 'asc'"
						/>
					</UTooltip>
				</div>
				<div
					v-for="section in groupedRuns"
					:key="section.label || 'all-runs'"
					class="flex flex-col gap-3"
				>
					<h2 v-if="section.label" class="font-semibold text-neutral-500">
						{{ section.label }}
					</h2>
					<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
						<TestRunCard
							v-for="item in section.items"
							:key="`${section.label}-${item.id}`"
							:run="item"
						/>
					</div>
				</div>
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
