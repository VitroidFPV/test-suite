<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import type { ResultType } from "~/types/resultTypes"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"
import { fetchRunsWithUsers } from "~/composables/fetchRunsWithUsers"

const toast = useToast()

const currentUser = useSupabaseUser()
const urlRun = useRoute().params.run as string

const supabase = useSupabaseClient<Database>()

type Run = Tables<"test_runs">
type RunCase = Tables<"test_cases">
type RunGroup = Tables<"test_run_groups">
type Report = Tables<"test_run_reports">

interface RunCaseWithResult extends RunCase {
	result: ResultType | null
	comment: string | null
}

// Fetch run details and associated run groups
const {
	data: runData,
	error: runDataError,
	refresh: refreshRun
} = await useAsyncData(
	`run-${urlRun}`,
	async () => {
		// Use fetchRunsWithUsers composable to get run with creator
		const runsWithUsers = await fetchRunsWithUsers(supabase, [urlRun])
		const runWithCreator = runsWithUsers[0]

		if (!runWithCreator) {
			throw new Error("Run not found")
		}

		// Get run groups from link table
		const { data: runGroupsData, error: runGroupsError } = await supabase
			.from("test_run_group_links")
			.select("group")
			.eq("run", runWithCreator.id)
		if (runGroupsError) {
			throw createSupabaseError(runGroupsError)
		}

		// Fetch full group details for each group ID
		const groupIds = runGroupsData.map((link) => link.group)
		let runGroups: RunGroup[] = []

		if (groupIds.length > 0) {
			const { data: groupsData, error: groupsError } = await supabase
				.from("test_run_groups")
				.select("*")
				.in("id", groupIds)
			if (groupsError) {
				throw createSupabaseError(groupsError)
			}
			runGroups = groupsData
		}

		// Fetch all run groups for the edit modal
		const { data: allRunGroupsData, error: allRunGroupsError } = await supabase
			.from("test_run_groups")
			.select("*")
		if (allRunGroupsError) {
			throw createSupabaseError(allRunGroupsError)
		}

		return {
			run: runWithCreator,
			runGroups,
			allRunGroups: allRunGroupsData || [],
			creator: runWithCreator.creator || null
		}
	},
	{ lazy: true }
)

// Computed properties for run data
const run = computed(() => runData.value?.run)
const runGroupsContainingTestRun = computed(() => runData.value?.runGroups)
const allRunGroups = computed(() => runData.value?.allRunGroups ?? [])
const creator = computed(() => runData.value?.creator)

useStablePageTitle({
	title: computed(() => {
		const title = run.value?.title?.trim()
		return title ? `${title} | Test Runs | Test Suite` : ""
	}),
	ready: computed(() => Boolean(run.value?.title?.trim()))
})

// Fetch run cases with their results
const {
	data: runCasesData,
	error: runCasesError,
	refresh: refreshRunCases
} = await useAsyncData(
	`runCases-${urlRun}`,
	async () => {
		const { data: runCasesDb, error: runCasesError } = await supabase
			.from("test_run_case_links")
			.select("case, result, comment")
			.eq("run", urlRun)
		if (runCasesError) {
			throw createSupabaseError(runCasesError)
		}

		if (runCasesDb.length === 0) {
			return []
		}

		// Get test cases
		const { data: cases, error: casesError } = await supabase
			.from("test_cases")
			.select("*")
			.in(
				"id",
				runCasesDb.map((c) => c.case)
			)
		if (casesError) {
			throw createSupabaseError(casesError)
		}

		// Merge cases with their results and comments
		return cases.map((testCase) => {
			const linkData = runCasesDb.find((link) => link.case === testCase.id)
			return {
				...testCase,
				result: linkData?.result || null,
				comment: linkData?.comment || null
			}
		})
	},
	{ lazy: true }
)

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (runDataError.value) errors.push(runDataError.value)
	if (runCasesError.value) errors.push(runCasesError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([refreshRun(), refreshRunCases()])
}

// Local reactive copy of run cases for optimistic updates
const runCases = ref<RunCaseWithResult[]>([])

// Sync local runCases with fetched data
watch(
	runCasesData,
	(newData) => {
		if (newData) {
			runCases.value = [...newData]
		}
	},
	{ immediate: true }
)

// Computed status stats
type StatusStat = { title: string; value: ResultType | "total"; number: number }
const statusStats = computed<StatusStat[]>(() => [
	{ title: "Total", value: "total", number: runCases.value.length },
	{
		title: "Passed",
		value: "passed",
		number: runCases.value.filter((c) => c.result === "passed").length
	},
	{
		title: "Failed",
		value: "failed",
		number: runCases.value.filter((c) => c.result === "failed").length
	},
	{
		title: "Blocked",
		value: "blocked",
		number: runCases.value.filter((c) => c.result === "blocked").length
	},
	{
		title: "Skipped",
		value: "skipped",
		number: runCases.value.filter((c) => c.result === "skipped").length
	},
	{
		title: "Not Run",
		value: "not_run",
		number: runCases.value.filter((c) => c.result === "not_run").length
	}
])

async function updateCaseResult(caseId: string, resultValue: ResultType) {
	if (!run.value) return

	// Update local state optimistically
	const caseItem = runCases.value.find((c) => c.id === caseId)
	const previousResult = caseItem?.result
	if (caseItem) {
		caseItem.result = resultValue
	}

	const { error } = await supabase
		.from("test_run_case_links")
		.update({
			result: resultValue
		})
		.eq("run", run.value.id)
		.eq("case", caseId)

	if (error) {
		console.error("Error updating result:", error)
		// Revert optimistic update on error
		if (caseItem) {
			caseItem.result = previousResult ?? null
		}
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
}

async function updateCaseComment(caseId: string, comment: string) {
	if (!run.value) return

	// Update local state optimistically
	const caseItem = runCases.value.find((c) => c.id === caseId)
	const previousComment = caseItem?.comment
	if (caseItem) {
		caseItem.comment = comment || null
	}

	const { error } = await supabase
		.from("test_run_case_links")
		.update({
			comment: comment || null
		})
		.eq("run", run.value.id)
		.eq("case", caseId)

	if (error) {
		console.error("Error updating comment:", error)
		// Revert optimistic update on error
		if (caseItem) {
			caseItem.comment = previousComment ?? null
		}
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
}

const confirmDeleteModalOpen = ref(false)

async function deleteRun() {
	const { error } = await supabase.from("test_runs").delete().eq("id", urlRun)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
	navigateTo("/runs")
}
const editedRun = ref<Run>({
	created_at: new Date().toISOString(),
	created_by: "",
	id: "",
	plan: null,
	title: ""
})
const selectedRunGroups = ref<string[]>([])

function selectRunGroup(runGroupId: string) {
	// called when user clicks on a run group in the edit mode
	// add it to the editedRun.run_groups array if it's not already in it
	// if it is, remove it from the array
	if (selectedRunGroups.value.includes(runGroupId)) {
		selectedRunGroups.value = selectedRunGroups.value.filter(
			(id) => id !== runGroupId
		)
	} else {
		selectedRunGroups.value = [...selectedRunGroups.value, runGroupId]
	}
}

async function saveRun() {
	if (!run.value) return
	const currentRun = run.value

	let hasErrors = false

	const { error } = await supabase
		.from("test_runs")
		.update({
			title: editedRun.value.title
		})
		.eq("id", currentRun.id)
	if (error) {
		console.error("Error updating run title:", error)
		hasErrors = true
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
	}

	// Handle run group links
	const currentGroupIds =
		runGroupsContainingTestRun.value?.map((g) => g.id) || []
	const groupsToAdd = selectedRunGroups.value.filter(
		(id) => !currentGroupIds.includes(id)
	)
	const groupsToRemove = currentGroupIds.filter(
		(id) => !selectedRunGroups.value.includes(id)
	)

	// Add new group links
	if (groupsToAdd.length > 0) {
		const linksToInsert = groupsToAdd.map((groupId) => ({
			run: currentRun.id,
			group: groupId
		}))
		const { error: insertError } = await supabase
			.from("test_run_group_links")
			.insert(linksToInsert)
		if (insertError) {
			console.error("Error adding group links:", insertError)
			hasErrors = true
			toast.add({
				title: "Error",
				description: insertError.message,
				color: "error"
			})
		}
	}

	// Remove old group links
	if (groupsToRemove.length > 0) {
		const { error: deleteError } = await supabase
			.from("test_run_group_links")
			.delete()
			.eq("run", currentRun.id)
			.in("group", groupsToRemove)
		if (deleteError) {
			console.error("Error removing group links:", deleteError)
			hasErrors = true
			toast.add({
				title: "Error",
				description: deleteError.message,
				color: "error"
			})
		}
	}

	// Always exit edit mode and refresh data, even if there were errors
	await Promise.all([refreshRun(), refreshRunCases()])

	editRunModalOpen.value = false

	if (hasErrors) {
		// TODO: Show user-friendly error notification
		console.warn("Some operations failed. Please verify the changes.")
	}
}

const newReport = ref<Report>({
	id: crypto.randomUUID(),
	title: "",
	run: urlRun,
	created_by: currentUser.value?.id || "",
	created_at: new Date().toISOString(),
	pass: false,
	comment: ""
})

function resetReportForm() {
	newReport.value = {
		id: crypto.randomUUID(),
		title: "",
		run: urlRun,
		created_by: currentUser.value?.id || "",
		created_at: new Date().toISOString(),
		pass: false,
		comment: ""
	}
}

const editRunModalOpen = ref(false)
const reportModalOpen = ref(false)

// Reset form each time modal opens to ensure fresh UUID and clear form data
watch(reportModalOpen, (isOpen) => {
	if (isOpen) {
		resetReportForm()
	}
})
async function generateReport() {
	if (!currentUser.value?.id) {
		console.error("Cannot generate report: User not authenticated")
		toast.add({
			title: "Error",
			description: "Cannot generate report: User not authenticated",
			color: "error"
		})
		return
	}

	const { error } = await supabase.from("test_run_reports").insert({
		id: newReport.value.id,
		run: urlRun,
		title: newReport.value.title || "New Report",
		created_by: currentUser.value.id,
		created_at: new Date().toISOString(),
		pass: newReport.value.pass,
		comment: newReport.value.comment
	})
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	// Create report links for all test cases with their current results
	const reportLinks = runCases.value.map((testCase) => ({
		report: newReport.value.id,
		case: testCase.id,
		result: testCase.result || "not_run",
		comment: testCase.comment || null
	}))

	const { error: linksError } = await supabase
		.from("test_run_report_case_links")
		.insert(
			reportLinks.map((link) => ({
				...link,
				result: link.result as ResultType
			}))
		)
	if (linksError) {
		console.error("Error creating report case links:", linksError)
		// Clean up the orphaned report to maintain database consistency
		const { error: cleanupError } = await supabase
			.from("test_run_reports")
			.delete()
			.eq("id", newReport.value.id)
		if (cleanupError) {
			console.error("Error cleaning up orphaned report:", cleanupError)
			toast.add({
				title: "Error",
				description: cleanupError.message,
				color: "error"
			})
		}
		return
	}

	reportModalOpen.value = false
}

function autoFillReportTitle() {
	if (run.value?.title) {
		newReport.value.title = `${run.value.title} Report`
	}
}

const isTestRunMode = ref(false)

const selectedCaseId = ref<string | undefined>(undefined)

// Load initial value from localStorage on client
onMounted(() => {
	const stored = localStorage.getItem("testRunMode")
	if (stored !== null) {
		isTestRunMode.value = stored === "true"
	}
})

// Save to localStorage whenever the value changes
watch(isTestRunMode, (newValue) => {
	localStorage.setItem("testRunMode", String(newValue))
})

// Select the first case when run mode is true and cases are loaded
// Clear selection when run mode is false
watch(
	[isTestRunMode, runCases],
	([mode, cases]) => {
		if (mode && cases.length > 0 && !selectedCaseId.value) {
			selectCase(cases[0]!.id)
		} else if (!mode) {
			selectedCaseId.value = undefined
		}
	},
	{ immediate: true }
)

function selectCase(caseId: string) {
	if (runCases.value.length > 0) {
		selectedCaseId.value = caseId
	}
}

function getCaseById(caseId: string): RunCaseWithResult | undefined {
	return runCases.value.find((c) => c.id === caseId)
}

const selectedCaseIndex = computed(() => {
	return runCases.value.findIndex((c) => c.id === selectedCaseId.value)
})

const selectedCase = computed(() =>
	selectedCaseId.value ? getCaseById(selectedCaseId.value) : undefined
)

// Select next/previous case, wrapping around if at the end/start, use the existing selectCase function
function nextCase() {
	if (!selectedCaseId.value) {
		if (runCases.value.length > 0) {
			selectCase(runCases.value[0]!.id)
		}
		return
	}
	const currentIndex = runCases.value.findIndex(
		(c) => c.id === selectedCaseId.value
	)
	const nextIndex = (currentIndex + 1) % runCases.value.length
	selectCase(runCases.value[nextIndex]!.id)
}

function previousCase() {
	if (!selectedCaseId.value) {
		if (runCases.value.length > 0) {
			selectCase(runCases.value[0]!.id)
		}
		return
	}
	const currentIndex = runCases.value.findIndex(
		(c) => c.id === selectedCaseId.value
	)
	const previousIndex =
		(currentIndex - 1 + runCases.value.length) % runCases.value.length
	selectCase(runCases.value[previousIndex]!.id)
}

function clearSelectedCase() {
	if (!isTestRunMode.value) {
		selectedCaseId.value = undefined
	}
}

const expandedCaseId = ref<string | undefined>(undefined)
function toggleCaseExpanded(caseId: string) {
	if (!selectedCaseId.value) return
	if (expandedCaseId.value === caseId) {
		expandedCaseId.value = undefined
	} else {
		expandedCaseId.value = caseId
	}
}
function isCaseExpanded(caseId: string) {
	return expandedCaseId.value === caseId
}

function updateSelectedCaseResult(result: ResultType) {
	if (!selectedCaseId.value) return
	updateCaseResult(selectedCaseId.value, result)
}

// Initialize editedRun and selectedRunGroups when data is loaded
watch(
	run,
	(newRun) => {
		if (newRun) {
			editedRun.value = { ...newRun }
			selectedRunGroups.value =
				runGroupsContainingTestRun.value?.map((group) => group.id) || []
		}
	},
	{ immediate: true }
)

defineShortcuts({
	shift_e: {
		handler: () => {
			if (runData.value) {
				editRunModalOpen.value = true
			}
		}
	},
	shift_r: {
		handler: () => {
			if (runData.value) {
				reportModalOpen.value = true
			}
		}
	},
	j: {
		handler: () => {
			previousCase()
		}
	},
	k: {
		handler: () => {
			nextCase()
		}
	},
	1: {
		handler: () => {
			updateSelectedCaseResult("not_run")
		}
	},
	2: {
		handler: () => {
			updateSelectedCaseResult("passed")
		}
	},
	3: {
		handler: () => {
			updateSelectedCaseResult("failed")
		}
	},
	4: {
		handler: () => {
			updateSelectedCaseResult("blocked")
		}
	},
	5: {
		handler: () => {
			updateSelectedCaseResult("skipped")
		}
	},
	escape: {
		handler: () => {
			clearSelectedCase()
		}
	},
	enter: {
		handler: () => {
			if (selectedCaseId.value) {
				toggleCaseExpanded(selectedCaseId.value)
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[
			{ label: 'Dashboard', to: '/' },
			{ label: 'Runs', to: '/runs' }
		]"
		:title="run?.title"
		:loading="!run && !pageError"
		:error="pageError"
		back-link="/runs"
		@retry="retryAll"
	>
		<template #title-trailing>
			<div class="flex gap-2 items-center">
				<UModal
					v-model:open="reportModalOpen"
					title="Generate Report"
					description="Generate a report for this test run"
					:ui="{ title: 'text-primary' }"
				>
					<UTooltip text="Generate Report" :kbds="['shift', 'R']">
						<UButton
							color="primary"
							size="sm"
							variant="soft"
							icon="i-lucide-file-text"
							:disabled="!runData"
							class="whitespace-nowrap"
						>
							Generate Report
						</UButton>
					</UTooltip>
					<template #body>
						<div class="flex flex-col gap-3 w-full">
							<UFieldGroup class="w-full">
								<UInput
									v-model="newReport.title"
									placeholder="Report Title"
									:ui="{ root: 'w-full' }"
								/>
								<UTooltip text="Automatic Fill (requires Run Title)">
									<UButton
										color="primary"
										icon="i-lucide-pencil"
										:disabled="!run?.title"
										@click="autoFillReportTitle()"
									>
									</UButton>
								</UTooltip>
							</UFieldGroup>
							<USwitch v-model="newReport.pass" label="Overall Pass?" />
							<UTextarea
								v-model="newReport.comment"
								placeholder="Report Comment"
							/>
						</div>
					</template>
					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="primary"
								size="sm"
								variant="solid"
								loading-auto
								@click="generateReport"
								>Generate Report</UButton
							>
						</div>
					</template>
				</UModal>

				<USeparator orientation="vertical" class="h-6" />

				<UModal
					v-model:open="editRunModalOpen"
					title="Edit Run"
					description="Edit the run title and run groups"
					:ui="{
						title: 'text-primary'
					}"
				>
					<UTooltip text="Edit Run" :kbds="['shift', 'E']">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							:disabled="!runData"
						/>
					</UTooltip>
					<template #body>
						<div class="flex flex-col gap-3">
							<UFormField label="Title">
								<UTextarea
									v-if="run"
									v-model="editedRun.title"
									placeholder="Run Title"
									color="primary"
									variant="soft"
									class="font-bold text-primary-500"
									autoresize
									:ui="{
										root: 'w-full'
									}"
								/>
							</UFormField>
							<UFormField label="Run Groups">
								<div class="flex gap-1 items-center">
									<UBadge
										v-for="runGroup in allRunGroups"
										:key="runGroup.id"
										:ui="{
											base: 'cursor-pointer rounded-full'
										}"
										:color="
											selectedRunGroups.includes(runGroup.id)
												? 'primary'
												: 'neutral'
										"
										:variant="
											selectedRunGroups.includes(runGroup.id) ? 'solid' : 'soft'
										"
										@click="selectRunGroup(runGroup.id)"
									>
										{{ runGroup.title }}
									</UBadge>
								</div>
							</UFormField>
						</div>
					</template>
					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="primary"
								size="sm"
								variant="soft"
								icon="i-lucide-save"
								loading-auto
								@click="saveRun"
							>
								Apply
							</UButton>
						</div>
					</template>
				</UModal>

				<UModal
					v-model:open="confirmDeleteModalOpen"
					title="Delete Run"
					description="Are you sure you want to delete this run? This action cannot be undone."
					:ui="{
						title: 'text-error'
					}"
				>
					<UTooltip text="Delete Run">
						<UButton
							color="error"
							size="sm"
							variant="soft"
							icon="i-lucide-trash"
						>
						</UButton>
					</UTooltip>

					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="neutral"
								size="sm"
								variant="soft"
								@click="confirmDeleteModalOpen = false"
								>Cancel</UButton
							>
							<UButton
								color="error"
								size="sm"
								variant="solid"
								icon="i-lucide-trash"
								loading-auto
								@click="deleteRun"
							>
								Delete Run
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</template>

		<template #description>
			<div class="flex gap-3 items-center flex-wrap">
				<div class="flex gap-2 items-center">
					<UAvatar
						v-if="creator"
						:src="creator.avatar ?? ''"
						:alt="creator.username"
					/>
					<USkeleton v-else class="h-8 w-8 rounded-full" />
					<div v-if="creator" class="text-neutral-500 font-semibold">
						{{ creator.username }}
					</div>
					<USkeleton v-else class="h-6 w-24" />
				</div>
				<USeparator orientation="vertical" class="h-6" />
				<div
					v-if="runGroupsContainingTestRun"
					class="flex gap-1 items-center text-neutral-500 font-semibold"
				>
					<UIcon name="i-lucide-library-big" class="h-4 w-4" />
					<div
						v-for="(runGroup, index) in runGroupsContainingTestRun"
						:key="runGroup.id"
						class="flex"
					>
						<NuxtLink
							class="hover:underline"
							:to="`/run-groups/${runGroup.id}`"
						>
							<span>{{ runGroup.title }}</span>
						</NuxtLink>
						<span v-if="index < runGroupsContainingTestRun.length - 1">,</span>
					</div>
					<div
						v-if="
							runGroupsContainingTestRun &&
							runGroupsContainingTestRun.length === 0
						"
					>
						<span>This test run is not associated with any run groups</span>
					</div>
				</div>
				<USkeleton v-else class="h-6 w-32" />
				<USeparator orientation="vertical" class="h-6" />
				<USwitch v-model="isTestRunMode" label="Test Run Mode" />
			</div>
			<TestStatusBar :status-stats="statusStats" />
		</template>

		<template v-if="runCases.length > 0" #content>
			<div v-if="!isTestRunMode" class="flex flex-col gap-y-3">
				<TestRunCaseCard
					v-for="item in runCases"
					:key="item.id"
					:run-case="item"
					:selected="selectedCaseId === item.id"
					:expanded="isCaseExpanded(item.id)"
					@update-result="updateCaseResult"
					@update-comment="updateCaseComment"
				/>
			</div>
			<div
				v-else
				class="grid xl:grid-cols-[fit-content(100%)_1fr_fit-content(100%)] grid-cols-2 h-full lg:gap-4 gap-2 lg:pb-0 pb-2"
			>
				<UButton
					color="primary"
					size="sm"
					variant="soft"
					leading-icon="i-lucide-arrow-left"
					:ui="{
						base: 'px-8 xl:order-1 order-3 justify-start lg:min-h-16 min-h-10'
					}"
					@click="previousCase()"
				>
					<UKbd color="primary" variant="subtle">J</UKbd>
				</UButton>
				<div
					class="w-full xl:col-span-1 col-span-2 order-2 flex flex-col lg:gap-6 gap-2"
				>
					<TestRunCaseCard
						v-if="selectedCase"
						:run-case="selectedCase"
						individual
						:individual-index="selectedCaseIndex"
						:total-cases="runCases.length"
						@update-result="updateCaseResult"
						@update-comment="updateCaseComment"
					/>
					<USeparator class="block xl:hidden" />
				</div>
				<UButton
					color="primary"
					size="sm"
					variant="soft"
					trailing-icon="i-lucide-arrow-right"
					:ui="{
						base: 'px-8 order-4 justify-end lg:min-h-16 min-h-10'
					}"
					@click="nextCase()"
				>
					<UKbd color="primary" variant="subtle">K</UKbd>
				</UButton>
			</div>
		</template>
	</PageWrapper>
</template>
