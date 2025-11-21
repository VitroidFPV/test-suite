<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"

const urlRun = useRoute().params.run as string

const supabase = useSupabaseClient<Database>()

type Run = Tables<"test_runs">
type RunCase = Tables<"test_cases">
type RunGroup = Tables<"test_run_groups">

interface RunCaseWithResult extends RunCase {
	result: string | null
	comment: string | null
}

const run = ref<Run>()
const runCases = ref<RunCaseWithResult[]>([])
const runGroupsContainingTestRun = ref<RunGroup[]>([])
const allRunGroups = ref<RunGroup[]>([])

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
	if (!run.value) {
		console.error("Run not found")
		return
	}

	// get run groups from link table
	const { data: runGroupsData, error: runGroupsError } = await supabase
		.from("test_run_group_links")
		.select("group")
		.eq("run", run.value.id)
	if (runGroupsError) {
		console.error(runGroupsError)
		return
	}

	// Fetch full group details for each group ID
	const groupIds = runGroupsData.map((link) => link.group)

	if (groupIds.length === 0) {
		runGroupsContainingTestRun.value = []
	} else {
		const { data: groupsData, error: groupsError } = await supabase
			.from("test_run_groups")
			.select("*")
			.in("id", groupIds)
		if (groupsError) {
			console.error(groupsError)
			return
		}
		runGroupsContainingTestRun.value = groupsData
	}

	const { data: allRunGroupsData, error: allRunGroupsError } = await supabase
		.from("test_run_groups")
		.select("*")
	if (allRunGroupsError) {
		console.error(allRunGroupsError)
		return
	}
	allRunGroups.value = allRunGroupsData
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
		.select("case, result, comment")
		.eq("run", run.value.id)
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

	// Merge cases with their results and comments
	runCases.value = cases.map((testCase) => {
		const linkData = runCasesDb.find((link) => link.case === testCase.id)
		return {
			...testCase,
			result: linkData?.result || null,
			comment: linkData?.comment || null
		}
	})
	updateStatusStats()
}

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

	// Update local state
	const caseItem = runCases.value.find((c) => c.id === caseId)
	if (caseItem) {
		caseItem.result = resultValue
	}

	updateStatusStats()
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
		icon: "i-lucide-circle-dot-dashed"
	},
	{
		label: "Passed",
		value: "passed",
		textColor: "text-lime-400",
		bgColor: "bg-lime-500/20",
		icon: "i-lucide-circle-check"
	},
	{
		label: "Failed",
		value: "failed",
		textColor: "text-red-400",
		bgColor: "bg-red-500/20",
		icon: "i-lucide-circle-x"
	},
	{
		label: "Blocked",
		value: "blocked",
		textColor: "text-yellow-400",
		bgColor: "bg-yellow-500/20",
		icon: "i-lucide-circle-alert"
	},
	{
		label: "Skipped",
		value: "skipped",
		textColor: "text-neutral-200",
		bgColor: "stripe-gradient",
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

const confirmDeleteModalOpen = ref(false)

async function deleteRun() {
	const { error } = await supabase.from("test_runs").delete().eq("id", urlRun)
	if (error) {
		console.error(error)
		return
	}
	navigateTo("/runs")
}
const editMode = ref(false)
const editedRun = ref<Run>({
	created_at: new Date().toISOString(),
	created_by: "",
	id: "",
	plan: null,
	title: ""
})
const selectedRunGroups = ref<string[]>([])

function enterEditMode() {
	if (run.value) {
		editedRun.value = { ...run.value }
		selectedRunGroups.value = runGroupsContainingTestRun.value.map(
			(group) => group.id
		)
	}
	editMode.value = true
}

function cancelEdit() {
	if (run.value) {
		editedRun.value = { ...run.value }
		selectedRunGroups.value = runGroupsContainingTestRun.value.map(
			(group) => group.id
		)
	}
	editMode.value = false
}

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
	let hasErrors = false

	const { error } = await supabase
		.from("test_runs")
		.update({
			title: editedRun.value.title
		})
		.eq("id", run.value!.id)
	if (error) {
		console.error("Error updating run title:", error)
		hasErrors = true
	}

	// Handle run group links
	const currentGroupIds = runGroupsContainingTestRun.value.map((g) => g.id)
	const groupsToAdd = selectedRunGroups.value.filter(
		(id) => !currentGroupIds.includes(id)
	)
	const groupsToRemove = currentGroupIds.filter(
		(id) => !selectedRunGroups.value.includes(id)
	)

	// Add new group links
	if (groupsToAdd.length > 0) {
		const linksToInsert = groupsToAdd.map((groupId) => ({
			run: run.value!.id,
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
			.eq("run", run.value!.id)
			.in("group", groupsToRemove)
		if (deleteError) {
			console.error("Error removing group links:", deleteError)
			hasErrors = true
		}
	}

	// Always exit edit mode and refresh data, even if there were errors
	editMode.value = false
	getRun()
	getRunCases()

	if (hasErrors) {
		// TODO: Show user-friendly error notification
		console.warn("Some operations failed. Please verify the changes.")
	}
}

getRun().then(() => {
	getRunCases()
	if (run.value) {
		editedRun.value = { ...run.value }
		selectedRunGroups.value = runGroupsContainingTestRun.value.map(
			(group) => group.id
		)
	}
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex justify-between items-center">
			<h1 class="text-3xl font-bold text-primary">Test Run</h1>
			<div class="flex gap-2 items-center">
				<Transition
					enter-active-class="transition-all duration-200"
					enter-from-class="opacity-0 translate-x-2"
					enter-to-class="opacity-100 translate-x-0"
					leave-active-class="transition-all duration-200"
					leave-from-class="opacity-100 translate-x-0"
					leave-to-class="opacity-0 translate-x-2"
				>
					<div v-if="editMode">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-save"
							@click="saveRun"
						>
							Save Changes
						</UButton>
					</div>
				</Transition>
				<UButton
					color="neutral"
					size="sm"
					variant="soft"
					icon="i-lucide-pencil"
					@click="editMode ? cancelEdit() : enterEditMode()"
				>
					{{ editMode ? "Cancel" : "Edit" }}
				</UButton>
				<UModal
					v-model:open="confirmDeleteModalOpen"
					title="Delete Test Run"
					description="Are you sure you want to delete this test run? This action cannot be undone."
					:ui="{
						title: 'text-error'
					}"
				>
					<UButton
						color="error"
						size="sm"
						variant="solid"
						icon="i-lucide-trash"
					>
						Delete Test Run
					</UButton>

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
								Delete Test Run
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</div>
		<div class="flex flex-col gap-2 w-full">
			<template v-if="!editMode">
				<h1 v-if="run" class="text-3xl font-bold text-primary">
					{{ run?.title }}
				</h1>
				<USkeleton v-else class="h-9 w-1/2" />
			</template>
			<UInput
				v-if="editMode"
				v-model="editedRun.title"
				:ui="{
					base: 'text-base font-bold text-primary'
				}"
				color="primary"
				placeholder="Run Title"
			/>

			<template v-if="!editMode">
				<div
					v-if="runGroupsContainingTestRun.length > 0 || run"
					class="flex gap-1 items-center text-neutral-500 font-semibold"
				>
					<UIcon name="i-lucide-library-big" class="h-4 w-4" />
					<div
						v-for="runGroup in runGroupsContainingTestRun"
						:key="runGroup.id"
						class="flex"
					>
						<NuxtLink
							class="hover:underline"
							:to="`/run-groups/${runGroup.id}`"
						>
							<span>{{ runGroup.title }}</span>
						</NuxtLink>
						<span
							v-if="
								runGroup !==
								runGroupsContainingTestRun[
									runGroupsContainingTestRun.length - 1
								]
							"
							>,</span
						>
					</div>
					<div v-if="runGroupsContainingTestRun.length === 0 && run">
						<span>This test run is not associated with any run groups</span>
					</div>
				</div>
				<USkeleton v-else class="h-6 w-1/4" />
			</template>
			<div v-if="editMode" class="flex gap-1 items-center">
				<UIcon name="i-lucide-library-big" class="h-4 w-4 text-neutral-500" />

				<UBadge
					v-for="runGroup in allRunGroups"
					:key="runGroup.id"
					:ui="{
						base: 'cursor-pointer rounded-full'
					}"
					:color="
						selectedRunGroups.includes(runGroup.id) ? 'primary' : 'neutral'
					"
					:variant="selectedRunGroups.includes(runGroup.id) ? 'solid' : 'soft'"
					@click="selectRunGroup(runGroup.id)"
				>
					{{ runGroup.title }}
				</UBadge>
			</div>
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
			<TestRunCaseCard
				v-for="item in runCases"
				:key="item.id"
				:run-case="item"
				@update-result="updateCaseResult"
				@update-comment="updateCaseComment"
			/>
		</div>
	</div>
</template>
