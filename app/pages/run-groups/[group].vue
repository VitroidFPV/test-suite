<script setup lang="ts">
import type { Database } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"
import TestRunCard from "~/components/cards/TestRunCard.vue"

const toast = useToast()

const route = useRoute()
const supabase = useSupabaseClient<Database>()

const groupId = route.params.group as string

// Helper function to fetch runs with user metadata
async function fetchRunsWithUsers(runIds?: string[]) {
	const query = supabase
		.from("test_runs")
		.select("*")
		.order("created_at", { ascending: false })

	const { data: runsData, error: runsError } = runIds
		? await query.in("id", runIds)
		: await query

	if (runsError) {
		throw createSupabaseError(runsError)
	}

	const runsArray = runsData || []

	// Get unique creator IDs
	const creatorIds = [
		...new Set(
			runsArray.filter((run) => run.created_by).map((run) => run.created_by)
		)
	]

	if (creatorIds.length === 0) {
		return runsArray.map((run) => ({ ...run, creator: undefined }))
	}

	// Fetch user metadata for all creators
	const { data: usersData, error: usersError } = await supabase
		.from("user_metadata")
		.select("*")
		.in(
			"id",
			creatorIds.filter((id): id is string => id !== null)
		)

	if (usersError) {
		throw createSupabaseError(usersError)
	}

	// Map users to their respective runs
	return runsArray.map((run) => ({
		...run,
		creator: usersData?.find((user) => user.id === run.created_by)
	}))
}

// Fetch run group details
const {
	data: runGroup,
	error: runGroupError,
	refresh: refreshRunGroup
} = await useAsyncData(
	`runGroup-${groupId}`,
	async () => {
		const { data, error } = await supabase
			.from("test_run_groups")
			.select("*")
			.eq("id", groupId)
			.single()
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

// Fetch runs linked to this group
const {
	data: runs,
	error: runsError,
	refresh: refreshRuns
} = await useAsyncData(
	`groupRuns-${groupId}`,
	async () => {
		// Get run IDs from the link table
		const { data: linkData, error: linkError } = await supabase
			.from("test_run_group_links")
			.select("run")
			.eq("group", groupId)

		if (linkError) {
			throw createSupabaseError(linkError)
		}

		const runIds = linkData?.map((link) => link.run) || []

		if (runIds.length === 0) {
			return []
		}

		return fetchRunsWithUsers(runIds)
	},
	{ lazy: true }
)

// Fetch all runs for the edit modal
const {
	data: allRuns,
	error: allRunsError,
	refresh: refreshAllRuns
} = await useAsyncData("allRunsForGroup", async () => fetchRunsWithUsers(), {
	lazy: true
})

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (runGroupError.value) errors.push(runGroupError.value)
	if (runsError.value) errors.push(runsError.value)
	if (allRunsError.value) errors.push(allRunsError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([refreshRunGroup(), refreshRuns(), refreshAllRuns()])
}

async function deleteRunGroup() {
	const { error } = await supabase
		.from("test_run_groups")
		.delete()
		.eq("id", groupId)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}
	navigateTo("/run-groups")
}

const confirmDeleteModalOpen = ref(false)
const mdPreviewMode = ref(false)
const editGroupModalOpen = ref(false)
const selectedRuns = ref<string[]>([])

const editedRunGroup = ref({
	created_at: new Date().toISOString(),
	description: "",
	id: "",
	name: "",
	title: ""
})

// Sync editedRunGroup when runGroup loads
watch(
	runGroup,
	(newGroup) => {
		if (newGroup) {
			editedRunGroup.value = {
				...newGroup,
				description: newGroup.description ?? ""
			}
		}
	},
	{ immediate: true }
)

// Initialize selected runs when modal opens
watch(editGroupModalOpen, (isOpen) => {
	if (isOpen) {
		selectedRuns.value = runs.value?.map((run) => run.id) || []
	}
})

function selectRun(runId: string) {
	if (selectedRuns.value.includes(runId)) {
		selectedRuns.value = selectedRuns.value.filter((id) => id !== runId)
	} else {
		selectedRuns.value = [...selectedRuns.value, runId]
	}
}

async function writeRunsToGroup() {
	if (!runGroup.value) return

	// add or remove runs from the group based on the selectedRuns array
	const currentRunIds = runs.value?.map((run) => run.id) || []
	const runsToAdd = selectedRuns.value.filter(
		(id: string) => !currentRunIds.includes(id)
	)
	const runsToRemove = currentRunIds.filter(
		(id: string) => !selectedRuns.value.includes(id)
	)

	// Insert new links first (safer - if this fails, no data is lost)
	if (runsToAdd.length > 0) {
		const { error } = await supabase
			.from("test_run_group_links")
			.insert(
				runsToAdd.map((runId) => ({ run: runId, group: runGroup.value!.id }))
			)
		if (error) {
			console.error("Error adding runs to group:", error)
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
			return
		}
	}

	// Remove old links after (if this fails, we just have extra links)
	if (runsToRemove.length > 0) {
		const { error } = await supabase
			.from("test_run_group_links")
			.delete()
			.in("run", runsToRemove)
			.eq("group", runGroup.value!.id)
		if (error) {
			console.error("Error removing runs from group:", error)
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
		}
	}

	await refreshRuns()
	editGroupModalOpen.value = false
}

async function saveRunGroup() {
	if (!runGroup.value) return

	const { error } = await supabase
		.from("test_run_groups")
		.update({
			title: editedRunGroup.value.title,
			description: editedRunGroup.value.description
		})
		.eq("id", runGroup.value.id)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	await writeRunsToGroup()
	await refreshRunGroup()
}

useHead({
	title: computed(() =>
		runGroup.value?.title
			? `${runGroup.value.title} | Test Suite`
			: "Run Group | Test Suite"
	)
})

defineShortcuts({
	shift_e: {
		handler: () => {
			if (runGroup.value && allRuns.value !== null) {
				editGroupModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[
			{ label: 'Dashboard', to: '/' },
			{ label: 'Run Groups', to: '/run-groups' }
		]"
		:title="runGroup?.title"
		:loading="!runGroup && !pageError"
		:error="pageError"
		back-link="/run-groups"
		@retry="retryAll"
	>
		<template #title-trailing>
			<div class="flex gap-2">
				<UModal
					v-model:open="editGroupModalOpen"
					title="Edit Run Group"
					description="Edit the run group title, description and runs"
					:ui="{
						content: 'max-w-6xl',
						title: 'text-primary'
					}"
				>
					<UTooltip text="Edit Run Group" :kbds="['shift', 'E']">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							:disabled="!runGroup || allRuns === null"
						/>
					</UTooltip>
					<template #body>
						<div class="flex flex-col gap-3">
							<UFormField label="Title">
								<UTextarea
									v-if="runGroup"
									v-model="editedRunGroup.title"
									placeholder="Run Group Title"
									color="primary"
									variant="soft"
									class="font-bold text-primary-500"
									autoresize
									:ui="{
										root: 'w-full'
									}"
								/>
							</UFormField>
							<!-- Description with markdown preview -->
							<div class="flex flex-col gap-2">
								<UFormField>
									<template #label>
										<div class="flex items-center gap-2">
											<span>Description</span>
											<USwitch
												v-model="mdPreviewMode"
												size="xs"
												label="Markdown Preview"
											/>
										</div>
									</template>
									<UTextarea
										v-if="!mdPreviewMode && runGroup"
										v-model="editedRunGroup.description"
										color="primary"
										placeholder="Run Group Description (supports Markdown)"
										variant="soft"
										:rows="4"
										autoresize
										:ui="{
											root: 'w-full'
										}"
									/>
								</UFormField>
								<div
									v-if="mdPreviewMode"
									class="md min-h-24 p-2 rounded-lg bg-neutral-800"
								>
									<VueMarkdown
										v-if="editedRunGroup.description"
										:source="editedRunGroup.description"
									/>
									<span v-else class="text-neutral-500">No description</span>
								</div>
							</div>
							<div
								class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
							>
								<TestRunCard
									v-for="run in allRuns"
									:key="run.id"
									:run="run"
									:ui="{
										root:
											'outline-2 outline-transparent duration-100 cursor-pointer' +
											(selectedRuns.includes(run.id)
												? ' outline-primary-500/50'
												: '')
									}"
									@click="selectRun(run.id)"
								/>
							</div>
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
								@click="saveRunGroup"
							>
								Apply
							</UButton>
						</div>
					</template>
				</UModal>
				<UModal
					v-model:open="confirmDeleteModalOpen"
					title="Delete Run Group"
					description="Are you sure you want to delete this run group? This action cannot be undone."
					:ui="{
						title: 'text-error'
					}"
				>
					<UTooltip text="Delete Run Group">
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
								@click="deleteRunGroup"
							>
								Delete Run Group
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</template>

		<template #description>
			<div class="md text-neutral-400">
				<VueMarkdown
					v-if="runGroup?.description"
					:source="runGroup.description"
				>
				</VueMarkdown>
				<span v-else class="text-neutral-500">No description</span>
			</div>
		</template>

		<template #content>
			<!-- Runs loaded with items -->
			<div
				v-if="runGroup && runs && runs.length > 0"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<TestRunCard v-for="item in runs" :key="item.id" :run="item" />
			</div>
			<!-- Loading state -->
			<div
				v-else-if="!runGroup || !runs"
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
			<!-- Empty state -->
			<div v-else class="text-neutral-500">
				No test runs in this group. Click "Edit Run Group" to add runs.
			</div>
		</template>
	</PageWrapper>
</template>
