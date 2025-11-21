<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"
import TestRunCard from "~/components/cards/TestRunCard.vue"

const options: typeof Options = {
	html: true
}

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">
type TestRun = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">
type TestRunWithUser = TestRun & { creator?: UserMetadata }

const sortedTestRuns = ref<TestRunWithUser[]>([])
async function getTestRuns() {
	const { data: runsData, error: runsError } = await supabase
		.from("test_runs")
		.select("*")

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
			sortedTestRuns.value = runsArray
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

		sortedTestRuns.value = runsWithUsers
	} else {
		sortedTestRuns.value = runsArray
	}
	sortTestRuns("title", "asc")
}

const runGroups = ref<RunGroup[]>([])
async function getRunGroups() {
	const { data, error } = await supabase.from("test_run_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	runGroups.value = data
}

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

function sortTestRuns(sortBy: string, sortOrder: string) {
	if (!sortedTestRuns.value) return

	sortedTestRuns.value = [...sortedTestRuns.value].sort((a, b) => {
		let aValue = a[sortBy as keyof TestRunWithUser]
		let bValue = b[sortBy as keyof TestRunWithUser]

		// Convert undefined/null to empty string for consistent sorting
		aValue = aValue ?? ""
		bValue = bValue ?? ""

		// For date fields, compare as Date
		let comparison = 0
		if (sortBy === "created_at") {
			const aTime = aValue ? new Date(aValue as string).getTime() : 0
			const bTime = bValue ? new Date(bValue as string).getTime() : 0
			comparison = aTime - bTime
		}

		if (typeof aValue === "string" && typeof bValue === "string") {
			comparison = aValue.localeCompare(bValue)
		} else if (typeof aValue === "number" && typeof bValue === "number") {
			comparison = aValue - bValue
		}
		if (sortOrder === "desc") {
			return -comparison
		}
		return comparison
	})
}

watch([testRunsSortBy, testRunsSortOrder], () => {
	sortTestRuns(testRunsSortBy.value.value, testRunsSortOrder.value.value)
	console.log(sortedTestRuns.value)
})

const selectedTestRuns = ref<string[]>([])

function selectTestRun(runId: string) {
	if (selectedTestRuns.value.includes(runId)) {
		selectedTestRuns.value = selectedTestRuns.value.filter((id) => id !== runId)
	} else {
		selectedTestRuns.value = [...selectedTestRuns.value, runId]
	}
	console.log("selectedTestRuns", selectedTestRuns.value)
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
	console.log("createRunGroup")
	console.log("selectedTestRuns", selectedTestRuns.value)
	console.log("newRunGroup", newRunGroup.value)

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
			console.error("Error linking runs to group:", linkError)
		}
	}

	getRunGroups()
	getTestRuns()
	createRunGroupModalOpen.value = false

	// Reset the form for next use
	newRunGroup.value = {
		name: "",
		id: crypto.randomUUID(),
		title: "",
		description: "",
		created_at: new Date().toISOString()
	}
}

getRunGroups()
getTestRuns()

useHead({
	title: `Run Groups | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex w-full justify-between">
			<h1 class="text-3xl font-bold text-primary">Run Groups</h1>
			<div class="flex flex-col">
				<UModal
					v-model:open="createRunGroupModalOpen"
					title="Create Run Group"
					description="Create a new run group, optionally add a description and include test runs"
					:ui="{
						title: 'text-primary',
						content: 'max-w-6xl'
					}"
				>
					<UButton
						color="primary"
						size="sm"
						variant="solid"
						icon="i-lucide-plus"
					>
						Create Run Group
					</UButton>
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
							<div
								class="grid gap-3 2xl:grid-cols-4 lg:grid-cols-3 grid-cols-2"
							>
								<TestRunCard
									v-for="run in sortedTestRuns"
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
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="primary"
								size="sm"
								variant="solid"
								icon="i-lucide-plus"
								@click="createRunGroup"
							>
								Create Run Group
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</div>
		<div class="flex flex-col lg:flex-row gap-3 w-full">
			<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
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
							<!-- <span v-if="plan.description" class="line-clamp-1 text-ellipsis">{{
		
							}}</span> -->
							<!-- <div v-else class="opacity-50">No description</div> -->
							<div class="md">
								<VueMarkdown
									v-if="run.description"
									:options="options"
									:source="run.description"
									class="line-clamp-3"
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
		</div>
	</div>
</template>
