<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import type { ResultType } from "~/types/resultTypes"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"
import VueMarkdown from "vue-markdown-render"

const toast = useToast()
const urlReport = useRoute().params.report as string

const supabase = useSupabaseClient<Database>()

const mdPreviewMode = ref(false)

const editReportModalOpen = ref(false)
const confirmDeleteModalOpen = ref(false)

const {
	data: report,
	error: reportError,
	refresh: refreshReport
} = await useAsyncData(
	`report-${urlReport}`,
	async () => {
		const { data, error } = await supabase.rpc("get_test_reports", {
			report_ids: [urlReport]
		})
		if (error) {
			throw createSupabaseError(error)
		}
		const reportResult = data[0]
		if (!reportResult) {
			throw new Error("Report not found")
		}

		const { data: creatorData, error: creatorError } = await supabase.rpc(
			"get_user_metadata",
			{ user_ids: [reportResult?.created_by] }
		)
		if (creatorError) {
			console.error(creatorError)
			return { report: reportResult, creator: null }
		}
		return { report: reportResult, creator: creatorData[0] }
	},
	{ lazy: true }
)

const user = useSupabaseUser()

const userIsLoggedIn = computed(() => user.value !== null)

const {
	data: userMetadata,
	error: userMetadataError,
	refresh: refreshUserMetadata
} = await useAsyncData(
	"reportPageUserMetadata",
	async () => {
		if (user.value?.id) {
			const { data, error } = await supabase.rpc("get_user_metadata", {
				user_ids: [user.value.id]
			})
			if (error) {
				throw createSupabaseError(error)
			}
			return data
		}
		return []
	},
	{ lazy: true }
)

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (reportError.value) errors.push(reportError.value)
	if (userMetadataError.value) errors.push(userMetadataError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([refreshReport(), refreshUserMetadata()])
}

const editedReport = ref<Tables<"test_run_reports">>({
	comment: "",
	created_at: "",
	created_by: "",
	id: "",
	pass: false,
	run: "",
	title: ""
})

// Populate editedReport when the edit modal opens
watch(editReportModalOpen, (isOpen) => {
	if (isOpen && report.value) {
		mdPreviewMode.value = false
		editedReport.value = {
			comment: report.value.report.comment || "",
			created_at: report.value.report.created_at,
			created_by: report.value.report.created_by,
			id: report.value.report.id,
			pass: report.value.report.pass,
			run: report.value.report.run,
			title: report.value.report.title || ""
		}
	}
})

async function saveReport() {
	if (!report.value) {
		console.error("Cannot save: report not loaded")
		toast.add({
			title: "Error",
			description: "Cannot save: report not loaded",
			color: "error"
		})
		return
	}
	const { error } = await supabase
		.from("test_run_reports")
		.update({
			title: editedReport.value.title,
			comment: editedReport.value.comment,
			pass: editedReport.value.pass
		})
		.eq("id", report.value.report.id)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
	editReportModalOpen.value = false
	await refreshReport()
}

async function deleteReport() {
	if (!urlReport) {
		console.error("Cannot delete: report ID missing from route")
		toast.add({
			title: "Error",
			description: "Cannot delete: report ID missing from route",
			color: "error"
		})
		return
	}
	const { error } = await supabase
		.from("test_run_reports")
		.delete()
		.eq("id", urlReport)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
	confirmDeleteModalOpen.value = false
	navigateTo("/reports")
}

const userIsDev = computed(() => {
	return userMetadata.value?.[0]?.role === "dev"
})

// user is guest if they are not logged in or if they don't have dev role
const userIsGuest = computed(() => {
	return !userIsLoggedIn.value || !userIsDev.value
})

watch(
	() => report.value?.report?.title,
	(title) => {
		if (title) {
			useHead({
				title: `${title} | Test Suite`
			})
		}
	},
	{ immediate: true }
)

type StatusStat = { title: string; value: ResultType | "total"; number: number }
type ReportCase = {
	id: string
	title: string
	text: string | null
	case_id: number | null
	created_at: string
	result: ResultType | null
	comment: string | null
}
const reportCases = computed<ReportCase[]>(() => {
	const cases = report.value?.report?.cases
	return (Array.isArray(cases) ? cases : []) as ReportCase[]
})
const statusStats = computed<StatusStat[]>(() => {
	const cases = reportCases.value
	return [
		{ title: "Total", value: "total", number: cases.length },
		{
			title: "Passed",
			value: "passed",
			number: cases.filter((c) => c.result === "passed").length
		},
		{
			title: "Failed",
			value: "failed",
			number: cases.filter((c) => c.result === "failed").length
		},
		{
			title: "Blocked",
			value: "blocked",
			number: cases.filter((c) => c.result === "blocked").length
		},
		{
			title: "Skipped",
			value: "skipped",
			number: cases.filter((c) => c.result === "skipped").length
		},
		{
			title: "Not Run",
			value: "not_run",
			number: cases.filter((c) => c.result === "not_run").length
		}
	]
})

defineShortcuts({
	shift_e: {
		handler: () => {
			if (report.value) {
				editReportModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="
			userIsGuest
				? []
				: [
						{ label: 'Dashboard', to: '/' },
						{ label: 'Test Reports', to: '/reports' }
					]
		"
		:title="report?.report.title"
		:loading="!report && !pageError"
		:error="pageError"
		back-link="/reports"
		@retry="retryAll"
	>
		<template #title-trailing>
			<div v-if="userIsLoggedIn" class="flex gap-2 items-center">
				<UModal
					v-model:open="editReportModalOpen"
					title="Edit Report"
					description="Edit the report title and comment, and overall pass status"
					:ui="{
						content: 'max-w-6xl',
						title: 'text-primary'
					}"
				>
					<UTooltip text="Edit Report" :kbds="['shift', 'E']">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							:disabled="!report"
						/>
					</UTooltip>
					<template #body>
						<div class="flex flex-col gap-3">
							<UFormField label="Title">
								<UTextarea
									v-if="report"
									v-model="editedReport.title"
									placeholder="Report Title"
									color="primary"
									variant="soft"
									class="font-bold text-primary-500"
									autoresize
									:ui="{
										root: 'w-full'
									}"
								/>
							</UFormField>
							<UFormField label="Overall Pass Status">
								<USwitch v-model="editedReport.pass" label="Passed" />
							</UFormField>
							<!-- Comment with markdown preview -->
							<div class="flex flex-col gap-2">
								<UFormField>
									<template #label>
										<div class="flex items-center gap-2">
											<span>Comment</span>
											<USwitch
												v-model="mdPreviewMode"
												size="xs"
												label="Markdown Preview"
											/>
										</div>
									</template>
									<UTextarea
										v-if="!mdPreviewMode"
										v-model="editedReport.comment"
										color="primary"
										placeholder="Report Comment (supports Markdown)"
										variant="soft"
										:rows="4"
										autoresize
										:ui="{
											root: 'w-full'
										}"
									/>
									<div
										v-if="mdPreviewMode"
										class="md min-h-23 p-2 rounded-lg bg-neutral-800"
									>
										<VueMarkdown
											v-if="editedReport.comment"
											:source="editedReport.comment"
										/>
										<span v-else class="text-neutral-500">No comment</span>
									</div>
								</UFormField>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="primary"
								size="sm"
								variant="solid"
								icon="i-lucide-save"
								loading-auto
								@click="saveReport"
							>
								Save Changes
							</UButton>
						</div>
					</template>
				</UModal>

				<UModal
					v-model:open="confirmDeleteModalOpen"
					title="Delete Report"
					description="Are you sure you want to delete this report? This action cannot be undone."
					:ui="{
						title: 'text-error'
					}"
				>
					<UTooltip text="Delete Report">
						<UButton
							color="error"
							size="sm"
							variant="soft"
							icon="i-lucide-trash"
							:disabled="!report"
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
								@click="deleteReport"
							>
								Delete Report
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</template>

		<template #description>
			<div class="flex gap-2 items-center">
				<UAvatar
					v-if="report?.creator"
					:src="report.creator.avatar ?? ''"
					:alt="report.creator.username"
				/>
				<div v-if="report?.creator" class="text-neutral-500 font-semibold">
					{{ report.creator.username }}
				</div>
			</div>
			<div v-if="report?.report.comment" class="md text-neutral-400">
				<VueMarkdown :source="report.report.comment"> </VueMarkdown>
			</div>
			<TestStatusBar v-if="report" :status-stats="statusStats" />
		</template>

		<template #content>
			<div v-if="report" class="flex flex-col gap-y-3">
				<TestRunCaseCard
					v-for="(item, index) in reportCases"
					:key="index"
					:run-case="item"
					readonly
				/>
			</div>
		</template>
	</PageWrapper>
</template>
