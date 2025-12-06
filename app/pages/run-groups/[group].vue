<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"
import TestRunCard from "~/components/cards/TestRunCard.vue"

const route = useRoute()

const supabase = useSupabaseClient<Database>()
type RunGroup = Tables<"test_run_groups">
type Run = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">

type RunWithUser = Run & { creator?: UserMetadata }

const runGroup = ref<RunGroup>()
const runs = ref<RunWithUser[] | undefined>(undefined)
const allRuns = ref<RunWithUser[]>([])

// slug group is id
async function getRunGroup() {
	const { data, error } = await supabase
		.from("test_run_groups")
		.select("*")
		.eq("id", route.params.group as string)
		.single()
	if (error) {
		console.error(error)
		return
	}
	runGroup.value = data
}

async function getAllRuns() {
	// Fetch all runs
	const { data: runsData, error: runsError } = await supabase
		.from("test_runs")
		.select("*")
		.order("created_at", { ascending: false })

	if (runsError) {
		console.error(runsError)
		return
	}

	const runsArray = runsData || []

	// Get unique creator IDs
	const creatorIds = [
		...new Set(
			runsArray.filter((run) => run.created_by).map((run) => run.created_by)
		)
	]

	if (creatorIds.length > 0) {
		// Fetch user metadata for all creators
		const { data: usersData, error: usersError } = await supabase
			.from("user_metadata")
			.select("*")
			.in(
				"id",
				creatorIds.filter((id): id is string => id !== null)
			)

		if (usersError) {
			console.error(usersError)
			allRuns.value = runsArray
			return
		}

		// Map users to their respective runs
		const runsWithUsers = runsArray.map((run) => {
			const creator = usersData?.find((user) => user.id === run.created_by)
			return {
				...run,
				creator
			}
		})

		allRuns.value = runsWithUsers
	} else {
		allRuns.value = runsArray
	}
}

async function getRuns() {
	// Get run IDs from the link table
	const { data: linkData, error: linkError } = await supabase
		.from("test_run_group_links")
		.select("run")
		.eq("group", route.params.group as string)

	if (linkError) {
		console.error(linkError)
		return
	}

	const runIds = linkData?.map((link) => link.run) || []

	if (runIds.length === 0) {
		runs.value = []
		return
	}

	// Fetch the actual runs
	const { data: runsData, error: runsError } = await supabase
		.from("test_runs")
		.select("*")
		.in("id", runIds)

	if (runsError) {
		console.error(runsError)
		return
	}

	const runsArray = runsData || []

	// Get unique creator IDs
	const creatorIds = [
		...new Set(
			runsArray.filter((run) => run.created_by).map((run) => run.created_by)
		)
	]

	if (creatorIds.length > 0) {
		// Fetch user metadata for all creators
		const { data: usersData, error: usersError } = await supabase
			.from("user_metadata")
			.select("*")
			.in(
				"id",
				creatorIds.filter((id): id is string => id !== null)
			)

		if (usersError) {
			console.error(usersError)
			runs.value = runsArray
			return
		}

		// Map users to their respective runs
		const runsWithUsers = runsArray.map((run) => {
			const creator = usersData?.find((user) => user.id === run.created_by)
			return {
				...run,
				creator
			}
		})

		runs.value = runsWithUsers
	} else {
		runs.value = runsArray
	}
}

async function deleteRunGroup() {
	const { error } = await supabase
		.from("test_run_groups")
		.delete()
		.eq("id", route.params.group as string)
	if (error) {
		console.error(error)
		return
	}
	navigateTo("/run-groups")
}

const confirmDeleteModalOpen = ref(false)
const editMode = ref(false)

const mdPreviewMode = ref(false)

const editedRunGroup = ref<RunGroup>({
	created_at: new Date().toISOString(),
	description: "",
	id: "",
	name: "",
	title: ""
})

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
		return
	}

	await writeRunsToGroup()

	editMode.value = false
	await getRunGroup()
	await getRuns()
}

const selectRunModalOpen = ref(false)
const selectedRuns = ref<string[]>([])

// Initialize selected runs when modal opens
watch(selectRunModalOpen, (isOpen) => {
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

	let hasErrors = false

	if (runsToAdd.length > 0) {
		const { error } = await supabase
			.from("test_run_group_links")
			.insert(
				runsToAdd.map((runId) => ({ run: runId, group: runGroup.value!.id }))
			)
		if (error) {
			console.error("Error adding runs to group:", error)
			hasErrors = true
		}
	}
	if (runsToRemove.length > 0) {
		const { error } = await supabase
			.from("test_run_group_links")
			.delete()
			.in("run", runsToRemove)
			.eq("group", runGroup.value!.id)
		if (error) {
			console.error("Error removing runs from group:", error)
			hasErrors = true
		}
	}

	// Always refresh data and close modal, even if there were errors
	await getRuns()
	selectRunModalOpen.value = false

	if (hasErrors) {
		// TODO: Show user-friendly error notification
		console.warn("Some operations failed. Please verify the changes.")
	}
}

getRunGroup().then(() => {
	if (runGroup.value) {
		editedRunGroup.value = { ...runGroup.value }
	}
})
getRuns()
getAllRuns()

useHead({
	title: computed(() =>
		runGroup.value?.title
			? `${runGroup.value.title} | Test Suite`
			: "Run Group | Test Suite"
	)
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[
			{ label: 'Dashboard', to: '/' },
			{ label: 'Run Groups', to: '/run-groups' }
		]"
		:title="runGroup?.title"
		:loading="!runGroup"
	>
		<template #title-trailing>
			<div class="flex gap-2">
				<UModal
					v-model:open="selectRunModalOpen"
					title="Edit Run Group"
					description="Edit the run group title, description and runs"
					:ui="{
						content: 'max-w-6xl',
						title: 'text-primary'
					}"
				>
					<UTooltip text="Edit Run Group">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							@click="selectRunModalOpen = true"
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
								variant="solid"
								icon="i-lucide-save"
								@click="saveRunGroup"
							>
								Save Changes
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
			<div class="md mt-4 text-neutral-400">
				<VueMarkdown
					v-if="runGroup?.description"
					:source="runGroup.description"
				>
				</VueMarkdown>
				<span v-else class="text-neutral-500">No description</span>
			</div>
		</template>

		<template #content>
			<div
				v-if="runs !== undefined"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<TestRunCard v-for="item in runs" :key="item.id" :run="item" />
			</div>
			<div
				v-else
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
		</template>
	</PageWrapper>
</template>
