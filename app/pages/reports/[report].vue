<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import type { ResultType } from "~/types/resultTypes"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"
import VueMarkdown from "vue-markdown-render"
import { groupCasesByCaseGroup } from "~/utils/groupCasesByCaseGroup"

type ReportForm = Omit<
	Tables<"test_run_reports">,
	"run_title" | "run_groups" | "snapshot_backfilled_at"
>

const toast = useToast()
const urlReport = useRoute().params.report as string

const supabase = useSupabaseClient<Database>()
const { dateTimeProps } = useDateTimeFormat()

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

		const cases = (
			Array.isArray(reportResult.cases) ? reportResult.cases : []
		) as ReportCase[]
		const legacyCaseGroups = cases.some(
			(testCase) => !Array.isArray(testCase.groups)
		)
			? await fetchCaseGroupData(
					supabase,
					cases.map((testCase) => testCase.id)
				)
			: null

		const { data: creatorData, error: creatorError } = await supabase.rpc(
			"get_user_metadata",
			{ user_ids: [reportResult?.created_by] }
		)
		if (creatorError) {
			console.error(creatorError)
			return {
				report: { ...reportResult, cases },
				creator: null,
				legacyCaseGroups
			}
		}
		return {
			report: { ...reportResult, cases },
			creator: creatorData[0],
			legacyCaseGroups
		}
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

const editedReport = ref<ReportForm>({
	comment: "",
	created_at: "",
	created_by: "",
	deleted_at: null,
	id: "",
	pass: false,
	run: "",
	discussion_url: null,
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
			deleted_at: null,
			id: report.value.report.id,
			pass: report.value.report.pass,
			run: report.value.report.run,
			discussion_url: report.value.report.discussion_url,
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
	const discussionUrl = optionalDiscordUrl(editedReport.value.discussion_url)
	if (discussionUrl === undefined) {
		toast.add({
			title: "Invalid URL",
			description: "Use a Discord HTTPS link.",
			color: "error"
		})
		return
	}
	const { error } = await supabase
		.from("test_run_reports")
		.update({
			title: editedReport.value.title,
			comment: editedReport.value.comment,
			discussion_url: discussionUrl,
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
		.update({ deleted_at: new Date().toISOString() })
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

useStablePageTitle({
	title: computed(() => {
		const title = report.value?.report?.title?.trim()
		return title ? `${title} | Test Reports | Test Suite` : ""
	}),
	ready: computed(() => Boolean(report.value?.report?.title?.trim()))
})

type StatusStat = { title: string; value: ResultType | "total"; number: number }
type ReportRunGroup = { id: string; title: string; image_url: string | null }
type ReportCaseGroup = { id: string; title: string; name: string }
const reportRunGroups = computed<ReportRunGroup[]>(() => {
	const groups = report.value?.report?.run_groups
	return (Array.isArray(groups) ? groups : []) as ReportRunGroup[]
})
type ReportCase = {
	id: string
	title: string
	text: string | null
	case_id: number | null
	created_at: string
	result: ResultType | null
	comment: string | null
	groups?: ReportCaseGroup[] | null
}
const reportCases = computed<ReportCase[]>(() => {
	const cases = report.value?.report?.cases
	return (Array.isArray(cases) ? cases : []) as ReportCase[]
})

const groupedReportCases = computed(() => {
	if (!report.value) {
		return undefined
	}

	const groups = new Map<string, ReportCaseGroup>()
	const links: { case: string; group: string }[] = []
	const sortOrder = new Map<string, number>()
	for (const [index, testCase] of reportCases.value.entries()) {
		sortOrder.set(testCase.id, index)
		for (const group of Array.isArray(testCase.groups) ? testCase.groups : []) {
			groups.set(group.id, group)
			links.push({ case: testCase.id, group: group.id })
		}
	}
	const caseGroups = report.value.legacyCaseGroups

	return groupCasesByCaseGroup(
		reportCases.value,
		caseGroups?.groups ?? [...groups.values()],
		caseGroups?.links ?? links,
		sortOrder
	)
})

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

const expandedCaseIds = ref<string[]>([])

function toggleCaseExpanded(caseId: string) {
	const set = new Set(expandedCaseIds.value)
	if (set.has(caseId)) {
		set.delete(caseId)
	} else {
		set.add(caseId)
	}
	expandedCaseIds.value = [...set]
}

function isCaseExpanded(caseId: string) {
	return expandedCaseIds.value.includes(caseId)
}

const casesWithComments = computed(() =>
	reportCases.value.filter((c) => (c.comment?.trim()?.length ?? 0) > 0)
)

const allCasesWithCommentsExpanded = computed(() => {
	const commented = casesWithComments.value
	if (commented.length === 0) return false
	const expanded = new Set(expandedCaseIds.value)
	return commented.every((c) => expanded.has(c.id))
})

function toggleCasesWithCommentsExpanded() {
	const commentIds = new Set(casesWithComments.value.map((c) => c.id))
	if (commentIds.size === 0) return
	if (allCasesWithCommentsExpanded.value) {
		expandedCaseIds.value = expandedCaseIds.value.filter(
			(id) => !commentIds.has(id)
		)
	} else {
		expandedCaseIds.value = [
			...new Set([...expandedCaseIds.value, ...commentIds])
		]
	}
}

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

const seoDescription = computed(() => {
	if (!report.value) return "Test Report"
	const r = report.value.report
	const total = statusStats.value[0]?.number ?? 0
	const countFor = (value: ResultType) =>
		statusStats.value.find((s) => s.value === value)?.number ?? 0
	const status = r.pass ? "Passed" : "Failed"
	return [
		`Status: ${status}`,
		`Passed: ${countFor("passed")}/${total}`,
		`Failed: ${countFor("failed")}/${total}`,
		`Blocked: ${countFor("blocked")}/${total}`,
		`Skipped: ${countFor("skipped")}/${total}`,
		`Not Run: ${countFor("not_run")}/${total}`
	].join(" | ")
})

useSeoMeta({
	ogTitle: computed(() => report.value?.report?.title || "Test Report"),
	title: computed(() => report.value?.report?.title || "Test Report"),
	description: seoDescription,
	ogDescription: seoDescription,
	twitterTitle: computed(() => report.value?.report?.title || "Test Report"),
	twitterDescription: seoDescription,
	twitterCard: "summary",
	ogType: "website",
	themeColor: computed(() =>
		report.value?.report?.pass ? "#96d735" : "#fb2c36"
	)
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
		<template #title>
			<UBadge
				v-if="report"
				:color="report.report.pass ? 'success' : 'error'"
				:label="report.report.pass ? 'Passed' : 'Failed'"
				variant="solid"
				size="lg"
				class="shrink-0 rounded-lg px-3 py-1.5 text-base font-bold ml-2"
			/>
		</template>
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
							<UFormField label="Public discussion message">
								<UInput
									v-model="editedReport.discussion_url"
									type="url"
									placeholder="https://discord.com/channels/..."
									class="w-full"
								/>
							</UFormField>
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
					description="Are you sure you want to delete this report?"
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
			<div
				v-if="report"
				class="flex flex-wrap gap-x-3 gap-y-2 items-center text-sm text-neutral-400"
			>
				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<div
						v-if="report.creator"
						class="inline-flex items-center gap-2 font-medium text-neutral-300"
					>
						<UAvatar
							:src="report.creator.avatar ?? ''"
							:alt="report.creator.username"
							size="sm"
						/>
						<span>{{ report.creator.username }}</span>
					</div>
					<div
						v-for="group in reportRunGroups"
						:key="group.id"
						class="inline-flex items-center gap-1 text-neutral-300"
					>
						<RunGroupImage
							:src="group.image_url"
							:alt="`${group.title} image`"
							size="xs"
							fallback
						/>
						<span>{{ group.title }}</span>
					</div>
				</div>
				<USeparator orientation="vertical" class="h-5" />
				<NuxtTime :datetime="report.report.created_at" v-bind="dateTimeProps" />
				<USeparator v-if="userIsLoggedIn" orientation="vertical" class="h-5" />
				<UButton
					v-if="userIsLoggedIn"
					:to="`/runs/${report.report.run}`"
					color="neutral"
					variant="soft"
					size="sm"
					label="View test run"
				/>
				<UButton
					v-if="optionalDiscordUrl(report.report.discussion_url)"
					:to="optionalDiscordUrl(report.report.discussion_url)"
					target="_blank"
					rel="noopener noreferrer"
					icon="i-simple-icons-discord"
					color="primary"
					variant="soft"
					size="sm"
					label="Discussion"
					class="ml-auto"
				/>
			</div>
			<div v-if="report?.report.comment" class="md max-w-4xl text-neutral-300">
				<VueMarkdown :source="report.report.comment"> </VueMarkdown>
			</div>
			<p
				v-if="report?.report.snapshot_backfilled_at"
				class="text-sm text-neutral-500"
			>
				Case and group details captured on
				<NuxtTime
					:datetime="report.report.snapshot_backfilled_at"
					v-bind="dateTimeProps"
				/>. Earlier versions are unavailable.
			</p>
			<TestStatusBar v-if="report" :status-stats="statusStats" />
		</template>

		<template #separator-trailing>
			<div
				v-if="casesWithComments.length > 0"
				class="flex items-center gap-2 shrink-0"
			>
				<UButton
					color="neutral"
					size="sm"
					:variant="allCasesWithCommentsExpanded ? 'subtle' : 'soft'"
					icon="i-lucide-chevrons-down"
					:ui="{
						leadingIcon: `transition-transform duration-200 ${allCasesWithCommentsExpanded ? 'rotate-180' : ''}`
					}"
					@click="toggleCasesWithCommentsExpanded"
				>
					{{
						allCasesWithCommentsExpanded
							? "Collapse comments"
							: "Expand comments"
					}}
				</UButton>
			</div>
		</template>

		<template #content>
			<div
				v-if="report && groupedReportCases && groupedReportCases.length > 0"
				class="flex flex-col gap-y-6"
			>
				<TestCaseGroupSection
					v-for="section in groupedReportCases"
					:key="section.group"
					:title="section.group"
				>
					<div class="flex flex-col gap-y-3">
						<TestRunCaseCard
							v-for="item in section.cases"
							:key="item.id"
							:run-case="item"
							:expanded="isCaseExpanded(item.id)"
							readonly
							@toggle-expanded="toggleCaseExpanded"
						/>
					</div>
				</TestCaseGroupSection>
			</div>
			<div
				v-else-if="report && groupedReportCases?.length === 0"
				class="text-neutral-500"
			>
				No test cases in this report.
			</div>
		</template>
	</PageWrapper>
</template>
