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

type Report = Tables<"test_run_reports">
type Run = Tables<"test_runs">
type User = Tables<"user_metadata">

const report = ref<Report>()
const run = ref<Run>()
const reportCreator = ref<User>()

const editMode = ref(false)
const mdPreviewMode = ref(false)

function enterEditMode() {
	editMode.value = true
}
function cancelEdit() {
	editMode.value = false
}

const confirmDeleteModalOpen = ref(false)

async function saveReport() {}
async function deleteReport() {}
const { data: reportData } = await useAsyncData("report", async () => {
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
})

report.value = reportData.value?.report as Report | undefined
reportCreator.value = reportData.value?.creator ?? undefined

const user = useSupabaseUser()

const userIsLoggedIn = user.value !== null

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

const userIsDev = computed(() => {
	return userMetadata.value?.[0]?.role === "dev"
})

// user is guest if they are not logged in or if they don't have dev role
const userIsGuest = computed(() => {
	return !userIsLoggedIn || !userIsDev.value
})
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
			<h1 v-if="report?.title" class="text-6xl font-bold text-primary mb-4">
				{{ report.title }}
			</h1>
			<USkeleton v-else class="h-15 w-1/2 mb-4" />

			<div class="flex gap-2 items-center">
				<UAvatar
					v-if="reportCreator"
					:src="reportCreator.avatar ?? ''"
					:alt="reportCreator.username"
				/>
				<div v-if="reportCreator" class="text-neutral-500 font-semibold">
					{{ reportCreator.username }}
				</div>
			</div>

			<template v-if="!editMode">
				<div v-if="report" class="md">
					<VueMarkdown
						v-if="report.comment"
						:options="options"
						:source="report.comment"
					>
					</VueMarkdown>
				</div>
				<USkeleton v-else class="h-6 w-1/3" />
			</template>
			<div
				v-if="editMode"
				class="flex flex-col gap-2 min-h-48 transition-all duration-200"
			>
				<USwitch v-model="mdPreviewMode" label="Markdown Preview" />
				<UTextarea
					v-if="!mdPreviewMode && report"
					v-model="report.comment"
					color="primary"
					placeholder="Run Group Description"
					variant="soft"
					:rows="8"
					autoresize
				/>
				<div v-if="mdPreviewMode" class="md h-full">
					<VueMarkdown
						v-if="report"
						:options="options"
						:source="report.comment"
					>
					</VueMarkdown>
				</div>
			</div>
		</div>
		<USeparator />
	</div>
</template>
