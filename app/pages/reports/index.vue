<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import BaseCard from "~/components/cards/BaseCard.vue"
import type { ListControlOption, ListSortOrder } from "~/utils/listGrouping"

const { dateTimeProps } = useDateTimeFormat()

const toast = useToast()

const supabase = useSupabaseClient<Database>()
const currentUser = useSupabaseUser()

type Report = Tables<"test_run_reports">
type User = Tables<"user_metadata">
type Run = Tables<"test_runs">
type RunGroup = Tables<"test_run_groups">

type ReportWithUser = Report & { creator?: User }
type ReportWithListMetadata = ReportWithUser & {
	runTitle: string
	runGroupTitles: string[]
	statusLabel: string
}

const {
	data: reportsData,
	error: reportsError,
	refresh: refreshReports
} = await useAsyncData(
	"reports",
	async () => {
		const { data, error } = await supabase
			.from("test_run_reports")
			.select("*")
			.is("deleted_at", null)
		if (error) {
			throw createSupabaseError(error)
		}

		// Return early if no reports
		if (data.length === 0) {
			return []
		}

		// Get unique creator IDs
		const creatorIds = [...new Set(data.map((report) => report.created_by))]

		// Fetch creator data
		const { data: creatorsData, error: creatorsError } = await supabase.rpc(
			"get_user_metadata",
			{ user_ids: creatorIds }
		)

		if (creatorsError) {
			throw createSupabaseError(creatorsError)
		}

		// Map creators to reports
		const reportsWithCreators: ReportWithUser[] = data.map((report) => ({
			...report,
			creator: creatorsData?.find((creator) => creator.id === report.created_by)
		}))

		return reportsWithCreators
	},
	{ lazy: true }
)

const {
	data: runsData,
	error: runsError,
	refresh: refreshRuns
} = await useAsyncData(
	"reportsRuns",
	async () => {
		const { data, error } = await supabase
			.from("test_runs")
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
	"reportRunGroups",
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
	"reportRunGroupLinks",
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
	if (reportsError.value) errors.push(reportsError.value)
	if (runsError.value) errors.push(runsError.value)
	if (runGroupsError.value) errors.push(runGroupsError.value)
	if (runGroupLinksError.value) errors.push(runGroupLinksError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([
		refreshReports(),
		refreshRuns(),
		refreshRunGroups(),
		refreshRunGroupLinks()
	])
}

const selectedRun = ref<{ label: string; value: string } | undefined>(undefined)
const formattedRuns = computed(() => {
	return runsData.value?.map((run) => ({
		label: run.title || "",
		value: run.id
	}))
})

const runById = computed(() => {
	return new Map((runsData.value ?? []).map((run) => [run.id, run as Run]))
})

const runGroupsByRunId = computed(() => {
	const groupsById = new Map(
		(runGroups.value ?? []).map((group) => [group.id, group as RunGroup])
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

const reportsWithListMetadata = computed<ReportWithListMetadata[] | undefined>(
	() => {
		if (!reportsData.value) return undefined

		return reportsData.value.map((report) => ({
			...report,
			runTitle: runById.value.get(report.run)?.title ?? "Unknown run",
			runGroupTitles: (runGroupsByRunId.value.get(report.run) ?? []).map(
				(group) => group.title
			),
			statusLabel: report.pass ? "Passed" : "Failed"
		}))
	}
)

const reportListOptions = ref<ListControlOption[]>([
	{ label: "Created At", value: "created_at" },
	{ label: "Name", value: "title" },
	{ label: "Author", value: "created_by" },
	{ label: "Run Group", value: "run_group" },
	{ label: "Status", value: "status" }
])
const reportGroupOptions = ref<ListControlOption[]>([
	{ label: "None", value: "none" },
	...reportListOptions.value.filter((option) => option.value !== "title")
])
const reportGroupBy = ref<ListControlOption>(reportGroupOptions.value[0]!)
const reportGroupSortOrder = ref<ListSortOrder>("asc")
const reportSortBy = ref<ListControlOption>(reportListOptions.value[0]!)
const reportSortOrder = ref<ListSortOrder>("desc")

function getReportListValue(report: ReportWithListMetadata, option: string) {
	if (option === "created_by") {
		return report.creator?.username ?? "Unknown user"
	}
	if (option === "run_group") {
		return report.runGroupTitles.join(", ")
	}
	if (option === "status") {
		return report.statusLabel
	}
	return report[option as keyof ReportWithListMetadata]
}

const sortedReports = computed(() => {
	if (!reportsWithListMetadata.value) return undefined

	return [...reportsWithListMetadata.value].sort((a, b) =>
		compareListValues(
			getReportListValue(a, reportSortBy.value.value),
			getReportListValue(b, reportSortBy.value.value),
			reportSortOrder.value
		)
	)
})

const groupedReports = computed(() => {
	if (!sortedReports.value) return undefined

	if (reportGroupBy.value.value === "none") {
		return [{ label: "", sortValue: "", items: sortedReports.value }]
	}

	if (reportGroupBy.value.value === "created_at") {
		return sortListSections(
			groupListItems(sortedReports.value, (report) =>
				createdDateGroupLabel(report.created_at)
			),
			reportGroupSortOrder.value
		)
	}

	if (reportGroupBy.value.value === "created_by") {
		return sortListSections(
			groupListItems(
				sortedReports.value,
				(report) => report.creator?.username ?? "Unknown user"
			),
			reportGroupSortOrder.value
		)
	}

	if (reportGroupBy.value.value === "run_group") {
		return sortListSections(
			groupListItems(sortedReports.value, (report) => report.runGroupTitles),
			reportGroupSortOrder.value
		)
	}

	if (reportGroupBy.value.value === "status") {
		return sortListSections(
			groupListItems(sortedReports.value, (report) => report.statusLabel),
			reportGroupSortOrder.value
		)
	}

	return [{ label: "", sortValue: "", items: sortedReports.value }]
})

const createReportModalOpen = ref(false)

const newReport = ref<Tables<"test_run_reports">>({
	id: crypto.randomUUID(),
	title: "",
	run: "",
	created_by: currentUser.value?.id || "",
	created_at: new Date().toISOString(),
	deleted_at: null,
	pass: false,
	comment: ""
})

function autoFillReportTitle() {
	if (selectedRun.value?.label) {
		newReport.value.title = `${selectedRun.value.label} Report`
	}
}

async function saveReport() {
	if (!selectedRun.value?.value) {
		console.error("No run selected")
		return
	}

	// 1. Get the cases from the selected test run in execution order
	const { data: runCases, error: runCasesError } = await supabase
		.from("test_run_case_links")
		.select("*")
		.eq("run", selectedRun.value.value)
		.order("sort_order", { ascending: true })

	if (runCasesError) {
		console.error("Error fetching run cases:", runCasesError)
		toast.add({
			title: "Error",
			description: runCasesError.message,
			color: "error"
		})
		return
	}

	// 2. Create the new report
	const reportToInsert = {
		id: newReport.value.id,
		title: newReport.value.title,
		run: selectedRun.value.value,
		created_by: currentUser.value?.id || "",
		created_at: new Date().toISOString(),
		pass: newReport.value.pass,
		comment: newReport.value.comment
	}

	const { error: reportError } = await supabase
		.from("test_run_reports")
		.insert(reportToInsert)

	if (reportError) {
		console.error("Error creating report:", reportError)
		toast.add({
			title: "Error",
			description: reportError.message,
			color: "error"
		})
		return
	}

	// 3. Create links between the report and cases from the selected run
	if (runCases && runCases.length > 0) {
		const reportCaseLinks = runCases.map((runCase, index) => ({
			report: newReport.value.id,
			case: runCase.case,
			result: runCase.result,
			comment: runCase.comment,
			sort_order: index
		}))

		const { error: linksError } = await supabase
			.from("test_run_report_case_links")
			.insert(reportCaseLinks)

		if (linksError) {
			console.error("Error creating report case links:", linksError)
			toast.add({
				title: "Error",
				description: linksError.message,
				color: "error"
			})
			return
		}
	}

	// Reset form and close modal
	createReportModalOpen.value = false
	newReport.value = {
		id: crypto.randomUUID(),
		title: "",
		run: "",
		created_by: currentUser.value?.id || "",
		created_at: new Date().toISOString(),
		deleted_at: null,
		pass: false,
		comment: ""
	}
	selectedRun.value = undefined

	// Refresh the reports list
	await refreshReports()
}

useStablePageTitle({
	title: `Test Reports | Test Suite`
})

defineShortcuts({
	shift_a: {
		handler: () => {
			if (runsData.value) {
				createReportModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Test Reports"
		:error="pageError"
		@retry="retryAll"
	>
		<template #title-trailing>
			<UModal
				v-model:open="createReportModalOpen"
				title="Create Report"
				description="Create a new test report, select a run and set the overall pass status and comment"
				:ui="{ title: 'text-primary' }"
			>
				<UTooltip text="Create Test Report" :kbds="['shift', 'A']">
					<UButton
						color="primary"
						size="sm"
						variant="soft"
						icon="i-lucide-plus"
						:disabled="!runsData"
					>
						New Test Report
					</UButton>
				</UTooltip>
				<template #body>
					<div class="flex flex-col gap-3 w-full">
						<UFormField class="w-full" label="Report Title">
							<UFieldGroup class="w-full">
								<UInput
									v-model="newReport.title"
									placeholder="Report Title"
									:ui="{ root: 'w-full' }"
								/>
								<UTooltip text="Automatic Fill (requires a selected run)">
									<UButton
										color="primary"
										icon="i-lucide-pencil"
										:disabled="!selectedRun?.label"
										@click="autoFillReportTitle()"
									>
									</UButton>
								</UTooltip>
							</UFieldGroup>
						</UFormField>
						<UFormField class="w-full" label="Test Run">
							<USelectMenu
								v-model="selectedRun"
								placeholder="Select a run"
								:items="formattedRuns"
								:ui="{ base: 'w-full' }"
							/>
						</UFormField>
						<UFormField label="Overall Pass Status">
							<USwitch
								v-model="newReport.pass"
								:label="newReport.pass ? 'Passed' : 'Failed'"
							/>
						</UFormField>
						<UFormField label="Comment">
							<UTextarea
								v-model="newReport.comment"
								placeholder="Report Comment"
								:ui="{ root: 'w-full' }"
							/>
						</UFormField>
					</div>
				</template>
				<template #footer>
					<div class="flex gap-3 justify-end w-full">
						<UButton
							color="primary"
							size="sm"
							variant="soft"
							:disabled="!newReport.title || !selectedRun?.value"
							loading-auto
							@click="saveReport"
							>Create Report</UButton
						>
					</div>
				</template>
			</UModal>
		</template>
		<template #content>
			<div
				v-if="reportsData && reportsData.length > 0"
				class="flex flex-col gap-4 w-full"
			>
				<div class="flex flex-wrap items-center gap-2">
					<div class="text-sm text-neutral-500">Group by</div>
					<USelectMenu
						v-model="reportGroupBy"
						:items="reportGroupOptions"
						:ui="{ content: 'min-w-fit' }"
						class="w-36"
					/>
					<UTooltip
						:text="
							reportGroupSortOrder === 'asc'
								? 'Sort groups ascending'
								: 'Sort groups descending'
						"
					>
						<UButton
							color="neutral"
							variant="ghost"
							size="sm"
							:disabled="reportGroupBy.value === 'none'"
							:icon="listSortOrderIcon(reportGroupSortOrder)"
							@click="
								reportGroupSortOrder =
									reportGroupSortOrder === 'asc' ? 'desc' : 'asc'
							"
						/>
					</UTooltip>
					<div class="text-sm text-neutral-500">Sort by</div>
					<USelectMenu
						v-model="reportSortBy"
						:items="reportListOptions"
						:ui="{ content: 'min-w-fit' }"
						class="w-36"
					/>
					<UTooltip
						:text="
							reportSortOrder === 'asc'
								? 'Sort items ascending'
								: 'Sort items descending'
						"
					>
						<UButton
							color="neutral"
							variant="ghost"
							size="sm"
							:icon="listSortOrderIcon(reportSortOrder)"
							@click="
								reportSortOrder = reportSortOrder === 'asc' ? 'desc' : 'asc'
							"
						/>
					</UTooltip>
				</div>
				<div
					v-for="section in groupedReports"
					:key="section.label || 'all-reports'"
					class="flex flex-col gap-3"
				>
					<h2 v-if="section.label" class="font-semibold text-neutral-500">
						{{ section.label }}
					</h2>
					<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
						<BaseCard
							v-for="item in section.items"
							:key="`${section.label}-${item.id}`"
							class="flex flex-col justify-between"
						>
							<template #header>
								<div class="flex items-center justify-between">
									<NuxtLink
										:to="`/reports/${item.id}`"
										class="font-bold text-primary hover:underline"
									>
										{{ item.title }}
									</NuxtLink>
									<UBadge
										:color="item.pass ? 'success' : 'error'"
										:label="item.pass ? 'Passed' : 'Failed'"
										variant="soft"
										class="font-semibold rounded-full"
									/>
								</div>
							</template>
							<template #default>
								<div
									class="text-sm text-neutral-500 flex items-center justify-between gap-1"
								>
									<div class="flex items-center gap-1">
										<UAvatar
											:src="item.creator?.avatar ?? ''"
											size="sm"
											class="rounded-full"
										/>
										{{ item.creator?.username || "Unknown user" }}
									</div>
									<NuxtTime
										:datetime="item.created_at"
										class="text-sm text-neutral-500"
										v-bind="dateTimeProps"
									/>
								</div>
							</template>
						</BaseCard>
					</div>
				</div>
			</div>
			<div
				v-else-if="!reportsData"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="i in 5" :key="i">
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
				No test reports yet. Click "Create Report" to create a new report.
			</div>
		</template>
	</PageWrapper>
</template>
