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

	useHead({
		title: `${runGroup.value?.title} | Test Suite`
	})
}

// async function getRuns() {
// 	const { data, error } = await supabase
// 		.from("test_runs")
// 		.select("*")
// 		.eq("group", route.params.group as string)
// 	if (error) {
// 		console.error(error)
// 		return
// 	}
// 	runs.value = data || []
// }

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

getRunGroup()
getRuns()
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Run Groups</h1>
		<div class="flex flex-col lg:flex-row gap-3 w-full">
			<div v-if="runGroup">
				<h1 class="text-6xl font-bold text-primary mb-8">
					{{ runGroup?.title }}
				</h1>
				<div class="md">
					<VueMarkdown
						v-if="runGroup.description"
						:options="options"
						:source="runGroup.description"
					>
					</VueMarkdown>
				</div>
			</div>
		</div>
		<USeparator />
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
