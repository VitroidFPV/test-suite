<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"
import TestRunCard from "~/components/cards/TestRunCard.vue"

const toast = useToast()

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">
type TestRun = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">
type TestRunWithUser = TestRun & { creator?: UserMetadata }

const {
	data: testRuns,
	error: testRunsError,
	refresh: refreshTestRuns
} = await useAsyncData(
	"testRuns",
	async () => {
		const { data: runsData, error: runsError } = await supabase
			.from("test_runs")
			.select("*")

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
	},
	{ lazy: true }
)

const {
	data: runGroups,
	error: runGroupsError,
	refresh: refreshRunGroups
} = await useAsyncData(
	"runGroups",
	async () => {
		const { data, error } = await supabase.from("test_run_groups").select("*")
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
	if (testRunsError.value) errors.push(testRunsError.value)
	if (runGroupsError.value) errors.push(runGroupsError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

const testRunsSortOptions = ref<{ label: string; value: string }[]>([
	{ label: "Title", value: "title" },
	{ label: "Created At", value: "created_at" },
	{ label: "Created By", value: "created_by" }
])
const testRunsSortOrders = ref<{ label: string; value: string }[]>([
	{ label: "Ascending", value: "asc" },
	{ label: "Descending", value: "desc" }
])
const testRunsSortBy = ref<{ label: string; value: string }>(
	testRunsSortOptions.value[0]!
)
const testRunsSortOrder = ref<{ label: string; value: string }>(
	testRunsSortOrders.value[0]!
)

const sortedTestRuns = computed(() => {
	if (!testRuns.value) return undefined

	const sortBy = testRunsSortBy.value.value
	const sortOrder = testRunsSortOrder.value.value

	return [...testRuns.value].sort((a, b) => {
		let aValue: unknown
		let bValue: unknown

		// For "Created By", sort by creator username instead of UUID
		if (sortBy === "created_by") {
			aValue = a.creator?.username ?? ""
			bValue = b.creator?.username ?? ""
		} else {
			aValue = a[sortBy as keyof TestRunWithUser]
			bValue = b[sortBy as keyof TestRunWithUser]
		}

		// Convert undefined/null to empty string for consistent sorting
		aValue = aValue ?? ""
		bValue = bValue ?? ""

		// For date fields, compare as Date
		let comparison = 0
		if (sortBy === "created_at") {
			const aTime = aValue ? new Date(aValue as string).getTime() : 0
			const bTime = bValue ? new Date(bValue as string).getTime() : 0
			comparison = aTime - bTime
		} else if (typeof aValue === "string" && typeof bValue === "string") {
			comparison = aValue.localeCompare(bValue)
		} else if (typeof aValue === "number" && typeof bValue === "number") {
			comparison = aValue - bValue
		}

		return sortOrder === "desc" ? -comparison : comparison
	})
})

const selectedTestRuns = ref<string[]>([])

function selectTestRun(runId: string) {
	if (selectedTestRuns.value.includes(runId)) {
		selectedTestRuns.value = selectedTestRuns.value.filter((id) => id !== runId)
	} else {
		selectedTestRuns.value = [...selectedTestRuns.value, runId]
	}
}

const newRunGroup = ref<RunGroup>({
	name: "",
	id: crypto.randomUUID(),
	title: "",
	description: "",
	created_at: new Date().toISOString()
})

const createRunGroupModalOpen = ref(false)

async function createRunGroup() {
	// create run group, name is kebab-case of title
	const { error } = await supabase.from("test_run_groups").insert([
		{
			id: newRunGroup.value.id,
			name: newRunGroup.value.title?.toLowerCase().replace(/\s/g, "-") ?? "",
			title: newRunGroup.value.title,
			description: newRunGroup.value.description,
			created_at: newRunGroup.value.created_at
		}
	])
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	// Link selected test runs to the newly created group
	if (selectedTestRuns.value.length > 0) {
		const runGroupLinks = selectedTestRuns.value.map((runId) => ({
			run: runId,
			group: newRunGroup.value.id
		}))

		const { error: linkError } = await supabase
			.from("test_run_group_links")
			.insert(runGroupLinks)

		if (linkError) {
			console.error(linkError)
			toast.add({
				title: "Error",
				description: linkError.message,
				color: "error"
			})
			return
		}
	}

	await Promise.all([refreshRunGroups(), refreshTestRuns()])
	createRunGroupModalOpen.value = false

	// Reset the form for next use
	newRunGroup.value = {
		name: "",
		id: crypto.randomUUID(),
		title: "",
		description: "",
		created_at: new Date().toISOString()
	}
	selectedTestRuns.value = []
}

async function handleRetry() {
	return Promise.all([refreshTestRuns(), refreshRunGroups()])
}

useHead({
	title: `Run Groups | Test Suite`
})

defineShortcuts({
	shift_a: {
		handler: () => {
			if (testRuns.value !== null) {
				createRunGroupModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Run Groups"
		:error="pageError"
		@retry="handleRetry"
	>
		<template #title-trailing>
			<UModal
				v-model:open="createRunGroupModalOpen"
				title="Create Run Group"
				description="Create a new run group, optionally add a description and include test runs"
				:ui="{
					title: 'text-primary',
					content: 'max-w-6xl'
				}"
			>
				<UTooltip text="Create Run Group" :kbds="['shift', 'A']">
					<UButton
						color="primary"
						size="sm"
						variant="soft"
						icon="i-lucide-plus"
					>
						New Run Group
					</UButton>
				</UTooltip>
				<template #body>
					<div class="flex flex-col gap-3">
						<UInput
							v-model="newRunGroup.title"
							placeholder="Run Group Title"
							class="w-full"
						/>
						<UTextarea
							v-model="newRunGroup.description"
							placeholder="Run Group Description"
							class="w-full"
							:rows="5"
						/>
						<USeparator />
						<div class="flex gap-3 items-center">
							<div class="text-sm text-neutral-500">Sort by:</div>
							<USelectMenu
								v-model="testRunsSortBy"
								:items="testRunsSortOptions"
								:ui="{
									content: 'min-w-fit'
								}"
								class="w-32"
							/>
							<div class="text-sm text-neutral-500">Sort order:</div>
							<USelectMenu
								v-model="testRunsSortOrder"
								:items="testRunsSortOrders"
								:ui="{
									content: 'min-w-fit'
								}"
								class="w-32"
							/>
						</div>
						<div class="grid gap-3 2xl:grid-cols-4 lg:grid-cols-3 grid-cols-2">
							<TestRunCard
								v-for="run in sortedTestRuns ?? []"
								:key="run.id"
								:run="run"
								:ui="{
									root:
										'outline-2 outline-transparent duration-100 cursor-pointer' +
										(selectedTestRuns.includes(run.id)
											? ' outline-primary-500/50'
											: '')
								}"
								@click="selectTestRun(run.id)"
							/>
							<div
								v-if="!sortedTestRuns"
								class="col-span-full text-center text-neutral-500 py-4"
							>
								Loading test runs...
							</div>
							<div
								v-else-if="sortedTestRuns.length === 0"
								class="col-span-full text-center text-neutral-500 py-4"
							>
								No test runs available
							</div>
						</div>
					</div>
				</template>
				<template #footer>
					<div class="flex gap-3 justify-end w-full">
						<UButton
							color="primary"
							size="sm"
							variant="soft"
							icon="i-lucide-plus"
							:disabled="!newRunGroup.title"
							loading-auto
							@click="createRunGroup"
						>
							Create Run Group
						</UButton>
					</div>
				</template>
			</UModal>
		</template>
		<template #content>
			<div
				v-if="runGroups"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="run in runGroups" :key="run.id">
					<BaseCard>
						<template #header>
							<NuxtLink
								class="font-bold text-primary hover:underline"
								:to="'/run-groups/' + run.id"
							>
								{{ run.title }}
							</NuxtLink>
						</template>
						<template #default>
							<div class="md">
								<VueMarkdown
									v-if="run.description"
									:source="run.description"
									class="line-clamp-2 text-ellipsis"
									style="
										mask-image: linear-gradient(
											180deg,
											#000000 60%,
											transparent 100%
										);
									"
								>
								</VueMarkdown>
							</div>
						</template>
					</BaseCard>
				</div>
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
			<div v-if="runGroups && runGroups.length === 0">
				No run groups yet. Click "Create Run Group" to create a new group.
			</div>
		</template>
	</PageWrapper>
</template>
