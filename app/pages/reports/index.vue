<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import BaseCard from "~/components/cards/BaseCard.vue"
import dayjs from "dayjs"

const supabase = useSupabaseClient<Database>()
const currentUser = useSupabaseUser()

type Report = Tables<"test_run_reports">
type User = Tables<"user_metadata">

type ReportWithUser = Report & { creator?: User }

const {
	data: reportsData,
	error: reportsError,
	refresh: refreshReports
} = await useAsyncData(
	"reports",
	async () => {
		const { data, error } = await supabase.from("test_run_reports").select("*")
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
			console.error(creatorsError)
			return data as ReportWithUser[]
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

// Consolidated page error
const pageError = computed(() => reportsError.value as Error | null)

const { data: runsData } = await useAsyncData(
	"runs",
	async () => {
		const { data, error } = await supabase.from("test_runs").select("*")
		if (error) {
			console.error(error)
			return []
		}
		return data
	},
	{ lazy: true }
)

const selectedRun = ref<{ label: string; value: string } | undefined>(undefined)
const formattedRuns = computed(() => {
	return runsData.value?.map((run) => ({
		label: run.title || "",
		value: run.id
	}))
})

const createReportModalOpen = ref(false)

const newReport = ref<Tables<"test_run_reports">>({
	id: crypto.randomUUID(),
	title: "",
	run: "",
	created_by: currentUser.value?.id || "",
	created_at: new Date().toISOString(),
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

	// 1. Get the cases from the selected test run
	const { data: runCases, error: runCasesError } = await supabase
		.from("test_run_case_links")
		.select("*")
		.eq("run", selectedRun.value.value)

	if (runCasesError) {
		console.error("Error fetching run cases:", runCasesError)
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
		return
	}

	// 3. Create links between the report and cases from the selected run
	if (runCases && runCases.length > 0) {
		const reportCaseLinks = runCases.map((runCase) => ({
			report: newReport.value.id,
			case: runCase.case,
			result: runCase.result,
			comment: runCase.comment
		}))

		const { error: linksError } = await supabase
			.from("test_run_report_case_links")
			.insert(reportCaseLinks)

		if (linksError) {
			console.error("Error creating report case links:", linksError)
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
		pass: false,
		comment: ""
	}
	selectedRun.value = undefined

	// Refresh the reports list
	await refreshReports()
}

useHead({
	title: `Test Reports | Test Suite`
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Test Reports"
		:error="pageError"
		@retry="refreshReports"
	>
		<template #title-trailing>
			<UModal
				v-model:open="createReportModalOpen"
				title="Create Report"
				description="Create a new test report, select a run and set the overall pass status and comment"
				:ui="{ title: 'text-primary' }"
			>
				<UButton color="primary" size="sm" variant="soft" icon="i-lucide-plus">
					Create Report
				</UButton>
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
							@click="saveReport"
							>Create Report</UButton
						>
					</div>
				</template>
			</UModal>
		</template>
		<template #content>
			<div
				v-if="reportsData"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<BaseCard
					v-for="item in reportsData"
					:key="item.id"
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
							<div class="text-sm text-neutral-500">
								{{ dayjs(item.created_at).format("D.MM.YYYY HH:mm") }}
							</div>
						</div>
					</template>
				</BaseCard>
			</div>
			<div
				v-else
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
			<div v-if="reportsData && reportsData.length == 0">
				No test reports yet. Click "Create Report" to create a new report.
			</div>
		</template>
	</PageWrapper>
</template>
