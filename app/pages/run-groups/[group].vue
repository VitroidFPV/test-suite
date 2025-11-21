<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"
import TestRunCard from "~/components/cards/TestRunCard.vue"

const options: typeof Options = {
	html: true
}

const route = useRoute()

const supabase = useSupabaseClient<Database>()
type RunGroup = Tables<"test_run_groups">
type Run = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">

type RunWithUser = Run & { creator?: UserMetadata }

const runGroup = ref<RunGroup>()
const runs = ref<RunWithUser[]>([])
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

function enterEditMode() {
	if (runGroup.value) {
		editedRunGroup.value = { ...runGroup.value }
	}
	editMode.value = true
}

function cancelEdit() {
	if (runGroup.value) {
		editedRunGroup.value = { ...runGroup.value }
	}
	editMode.value = false
}

async function saveRunGroup() {
	const { error } = await supabase
		.from("test_run_groups")
		.update({
			title: editedRunGroup.value.title,
			description: editedRunGroup.value.description
		})
		.eq("id", runGroup.value!.id)
	if (error) {
		console.error(error)
		return
	}

	editMode.value = false
	getRunGroup()
	getRuns()
}

const selectRunModalOpen = ref(false)
const selectedRuns = ref<string[]>([])

// Initialize selected runs when modal opens
watch(selectRunModalOpen, (isOpen) => {
	if (isOpen) {
		selectedRuns.value = runs.value.map((run) => run.id)
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
	<div class="flex flex-col gap-y-6">
		<div class="flex justify-between items-center">
			<h1 class="text-3xl font-bold text-primary">Run Group</h1>
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
							@click="saveRunGroup"
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
					title="Delete Run Group"
					description="Are you sure you want to delete this run group? This action cannot be undone."
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
						Delete Run Group
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
								@click="deleteRunGroup"
							>
								Delete Run Group
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</div>
		<div class="flex flex-col gap-3 w-full">
			<template v-if="!editMode">
				<h1 v-if="runGroup?.title" class="text-6xl font-bold text-primary mb-4">
					{{ runGroup.title }}
				</h1>
				<USkeleton v-else class="h-15 w-1/2 mb-4" />
			</template>
			<UInput
				v-if="editMode"
				v-model="editedRunGroup.title"
				:ui="{
					base: 'text-6xl font-bold text-primary mb-4 bg-neutral-500/10 p-0 gap-0 h-15 ring-8 ring-neutral-500/10'
				}"
				color="primary"
				placeholder="Run Group Title"
				variant="none"
			/>

			<template v-if="!editMode">
				<div v-if="runGroup" class="md">
					<VueMarkdown
						v-if="runGroup.description"
						:options="options"
						:source="runGroup.description"
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
					v-if="!mdPreviewMode"
					v-model="editedRunGroup.description"
					color="primary"
					placeholder="Run Group Description"
					variant="soft"
					:rows="8"
					autoresize
				/>
				<div v-if="mdPreviewMode" class="md h-full">
					<VueMarkdown :options="options" :source="editedRunGroup.description">
					</VueMarkdown>
				</div>
			</div>
		</div>
		<div class="flex gap-2 w-full justify-end items-center">
			<USeparator />
			<UModal
				v-model:open="selectRunModalOpen"
				title="Select Runs"
				description="Select the runs you want to add to this run group"
				:ui="{
					title: 'text-primary'
				}"
			>
				<UButton
					color="neutral"
					size="sm"
					variant="soft"
					icon="i-lucide-pencil"
					:ui="{
						base: 'whitespace-nowrap'
					}"
					@click="selectRunModalOpen = true"
				>
					Edit Runs
				</UButton>
				<template #body>
					<TestRunCard
						v-for="run in allRuns"
						:key="run.id"
						:run="run"
						:ui="{
							root:
								'outline-2 outline-transparent duration-100 cursor-pointer' +
								(selectedRuns.includes(run.id) ? ' outline-primary-500/50' : '')
						}"
						@click="selectRun(run.id)"
					/>
				</template>
				<template #footer>
					<div class="flex gap-3 justify-end w-full">
						<UButton
							color="primary"
							size="sm"
							variant="solid"
							icon="i-lucide-save"
							@click="writeRunsToGroup"
						>
							Save Changes
						</UButton>
					</div>
				</template>
			</UModal>
		</div>
		<div
			v-if="runs.length > 0"
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
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-neutral-500">
								<USkeleton class="w-1/2 h-6" />
							</div>
							<div class="flex items-center gap-2">
								<USkeleton width="w-1/2 h-6" />
							</div>
						</div>
					</template> -->
				</BaseCard>
			</div>
		</div>
	</div>
</template>
