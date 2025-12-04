<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCaseCard from "~/components/cards/TestRunCaseCard.vue"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const urlReport = useRoute().params.report as string

const supabase = useSupabaseClient<Database>()

const editMode = ref(false)
const mdPreviewMode = ref(false)

function enterEditMode() {
	if (report.value?.report) {
		editedReport.value = { ...report.value.report }
	}
	editMode.value = true
}
function cancelEdit() {
	if (report.value?.report) {
		editedReport.value = { ...report.value.report }
	}
	editMode.value = false
}

const confirmDeleteModalOpen = ref(false)

const {
	data: report,
	error: reportError,
	refresh: refreshReport
} = await useAsyncData(
	"report",
	async () => {
		const { data, error } = await supabase.rpc("get_test_reports", {
			report_ids: [urlReport]
		})
		if (error) {
			console.error(error)
			return null
		}
		const reportResult = data[0]
		if (!reportResult) {
			console.error("Report not found")
			return null
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

const { data: userMetadata } = await useAsyncData(
	"reportPageUserMetadata",
	async () => {
		if (user.value?.id) {
			const { data, error } = await supabase.rpc("get_user_metadata", {
				user_ids: [user.value.id]
			})
			if (error) {
				console.error(error)
				return []
			}
			return data
		}
		return []
	}
)

const editedReport = ref<Tables<"test_run_reports">>({
	comment: "",
	created_at: new Date().toISOString(),
	created_by: "",
	id: "",
	pass: false,
	run: "",
	title: ""
})

async function saveReport() {
	const { data, error } = await supabase
		.from("test_run_reports")
		.update({
			title: editedReport.value.title,
			comment: editedReport.value.comment,
			pass: editedReport.value.pass
		})
		.eq("id", report.value!.report.id)
	if (error) {
		console.error(error)
		return
	}
	editMode.value = false
	refreshReport()
}

async function deleteReport() {
	const { error } = await supabase
		.from("test_run_reports")
		.delete()
		.eq("id", urlReport)
	if (error) {
		console.error(error)
		return
	}
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
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex justify-between items-center">
			<div class="flex gap-4 items-center">
				<h1 class="text-3xl font-bold text-primary">Test Report</h1>
			</div>
			<div v-if="!userIsGuest" class="flex gap-2 items-center">
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
							@click="saveReport"
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
					title="Delete Test Report"
					description="Are you sure you want to delete this test report? This action cannot be undone."
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
						Delete Test Report
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
								@click="deleteReport"
							>
								Delete Test Report
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</div>
		<div class="flex flex-col gap-3 w-full">
			<template v-if="!editMode">
				<h1
					v-if="report?.report.title"
					class="text-5xl font-bold text-primary mb-4"
				>
					{{ report.report.title }}
				</h1>
				<USkeleton v-else class="h-15 w-1/2 mb-4" />
			</template>
			<UTextarea
				v-if="editMode"
				v-model="editedReport.title"
				:ui="{
					base: 'text-5xl font-bold text-primary mb-4 bg-neutral-500/10 p-0 pb-2 gap-0 outline-8 outline-neutral-500/10'
				}"
				color="primary"
				placeholder="Report Title"
				variant="none"
				autoresize
				:rows="1"
				:maxrows="3"
			/>

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

			<template v-if="!editMode">
				<template v-if="report">
					<div v-if="report.report.comment" class="md">
						<VueMarkdown :options="options" :source="report.report.comment">
						</VueMarkdown>
					</div>
				</template>
				<USkeleton v-else class="h-6 w-1/3" />
			</template>
			<div
				v-if="editMode"
				class="flex flex-col gap-2 min-h-48 transition-all duration-200"
			>
				<USwitch v-model="mdPreviewMode" label="Markdown Preview" />
				<UTextarea
					v-if="!mdPreviewMode && report"
					v-model="editedReport.comment"
					color="primary"
					placeholder="Run Group Description"
					variant="soft"
					:rows="8"
					autoresize
				/>
				<div v-if="mdPreviewMode" class="md h-full">
					<VueMarkdown
						v-if="editedReport.comment"
						:options="options"
						:source="editedReport.comment"
					>
					</VueMarkdown>
				</div>
			</div>
		</div>
		<USeparator />
	</div>
</template>
