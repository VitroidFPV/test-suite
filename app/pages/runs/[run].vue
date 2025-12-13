<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"

const currentUser = useSupabaseUser()
const urlRun = useRoute().params.run as string

const supabase = useSupabaseClient<Database>()

type Run = Tables<"test_runs">
type RunCase = Tables<"test_cases">
type RunGroup = Tables<"test_run_groups">
type Report = Tables<"test_run_reports">

interface RunCaseWithResult extends RunCase {
	result: string | null
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
		const { data, error } = await supabase
			.from("test_runs")
			.select("*")
			.eq("id", urlRun)
			.single()
		if (error) {
			throw createSupabaseError(error)
		}

		// Get run groups from link table
		const { data: runGroupsData, error: runGroupsError } = await supabase
			.from("test_run_group_links")
			.select("group")
			.eq("run", data.id)
		if (runGroupsError) {
			console.error(runGroupsError)
			return { run: data, runGroups: [], allRunGroups: [] }
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
				console.error(groupsError)
			} else {
				runGroups = groupsData
			}
		}

		// Fetch all run groups for the edit modal
		const { data: allRunGroupsData, error: allRunGroupsError } = await supabase
			.from("test_run_groups")
			.select("*")
		if (allRunGroupsError) {
			console.error(allRunGroupsError)
		}

		return {
			run: data,
			runGroups,
			allRunGroups: allRunGroupsData || []
		}
	},
	{ lazy: true }
)

// Consolidated page error
const pageError = computed(() => runDataError.value as Error | null)

// Computed properties for run data
const run = computed(() => runData.value?.run)
const runGroupsContainingTestRun = computed(() => runData.value?.runGroups)
const allRunGroups = computed(() => runData.value?.allRunGroups ?? [])

// Fetch run cases with their results
const { data: runCasesData, refresh: refreshRunCases } = await useAsyncData(
	`runCases-${urlRun}`,
	async () => {
		const { data: runCasesDb, error: runCasesError } = await supabase
			.from("test_run_case_links")
			.select("case, result, comment")
			.eq("run", urlRun)
		if (runCasesError) {
			console.error(runCasesError)
			return []
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
			console.error(casesError)
			return []
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
const statusStats = computed(() => {
	const stats = [
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
	]
	return stats
})

async function updateCaseResult(caseId: string, resultValue: string) {
	if (!run.value) return

	const { error } = await supabase
		.from("test_run_case_links")
		.update({
			result: resultValue as
				| "passed"
				| "failed"
				| "blocked"
				| "skipped"
				| "not_run"
		})
		.eq("run", run.value.id)
		.eq("case", caseId)

	if (error) {
		console.error("Error updating result:", error)
		return
	}

	// Update local state (optimistic update)
	const caseItem = runCases.value.find((c) => c.id === caseId)
	if (caseItem) {
		caseItem.result = resultValue
	}
}

async function updateCaseComment(caseId: string, comment: string) {
	if (!run.value) return

	const { error } = await supabase
		.from("test_run_case_links")
		.update({
			comment: comment || null
		})
		.eq("run", run.value.id)
		.eq("case", caseId)

	if (error) {
		console.error("Error updating comment:", error)
		return
	}

	// Update local state
	const caseItem = runCases.value.find((c) => c.id === caseId)
	if (caseItem) {
		caseItem.comment = comment || null
	}
}

const confirmDeleteModalOpen = ref(false)

async function deleteRun() {
	const { error } = await supabase.from("test_runs").delete().eq("id", urlRun)
	if (error) {
		console.error(error)
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
				result: link.result as
					| "not_run"
					| "passed"
					| "failed"
					| "blocked"
					| "skipped"
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
		@retry="refreshRun"
	>
		<template #title-trailing>
			<div class="flex gap-2 items-center">
				<UModal
					v-model:open="reportModalOpen"
					title="Generate Report"
					description="Generate a report for this test run"
					:ui="{ title: 'text-primary' }"
				>
					<UButton
						color="primary"
						size="sm"
						variant="soft"
						icon="i-lucide-file-text"
					>
						Generate Report
					</UButton>
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
					<UTooltip text="Edit Run">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
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
			<div
				v-if="runGroupsContainingTestRun"
				class="flex gap-1 items-center text-neutral-500 font-semibold"
			>
				<UIcon name="i-lucide-library-big" class="h-4 w-4" />
				<div
					v-for="runGroup in runGroupsContainingTestRun"
					:key="runGroup.id"
					class="flex"
				>
					<NuxtLink class="hover:underline" :to="`/run-groups/${runGroup.id}`">
						<span>{{ runGroup.title }}</span>
					</NuxtLink>
					<span
						v-if="
							runGroupsContainingTestRun &&
							runGroup !==
								runGroupsContainingTestRun[
									runGroupsContainingTestRun.length - 1
								]
						"
						>,</span
					>
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
			<USkeleton v-else class="h-6 w-1/4" />
			<TestStatusBar :status-stats="statusStats" />
		</template>

		<template #content>
			<div class="flex flex-col gap-y-3">
				<TestRunCaseCard
					v-for="item in runCases"
					:key="item.id"
					:run-case="item"
					@update-result="updateCaseResult"
					@update-comment="updateCaseComment"
				/>
			</div>
		</template>
	</PageWrapper>
</template>
