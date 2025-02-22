<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const route = useRoute()

const supabase = useSupabaseClient<Database>()
type RunGroup = Tables<"test_run_groups">
type Run = Tables<"test_runs">

const runGroup = ref<RunGroup>()
const runs = ref<Run[]>([])

// slug group is id
async function getRunGroup() {
	const { data, error } = await supabase
		.from("test_run_groups")
		.select("*")
		.eq("id", route.params.group)
	if (error) {
		console.error(error)
		return
	}
	runGroup.value = data[0]

	useHead({
		title: `${runGroup.value?.title} | Test Suite`
	})
}

async function getRuns() {
	const { data: runLinks, error: runLinksError } = await supabase
		.from("test_run_group_links")
		.select("run")
		.eq("run_group", route.params.group)

	if (runLinksError) {
		console.error(runLinksError)
		return
	}
	console.log(runLinks)

	const runIds = runLinks.map((link) => link.run)

	const { data: runsData, error: runsError } = await supabase
		.from("test_runs")
		.select("*")
		.in("id", runIds)

	if (runsError) {
		console.error(runsError)
		return
	}

	runs.value = runsData
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
		<UDivider />
		<div
			v-if="runs.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="item in runs" :key="item.id">
				<UCard
					:ui="{
						header: { padding: 'px-4 py-3 sm:p-4' },
						body: { padding: 'px-4 py-3 sm:p-4' },
						footer: { padding: 'px-4 py-3 sm:p-4' }
					}"
				>
					<template #header>
						<div class="font-bold text-primary-500">
							{{ item.title }}
						</div>
					</template>
					<template #default>
						<!-- <span v-if="item.description" class="line-clamp-1 text-ellipsis">{{
							item.description
						}}</span>
						<div v-else class="opacity-50">No description</div> -->
					</template>
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-gray-500">
								{{ dayjs(item.created_at).format("D.MM.YYYY HH:mm") }}
							</div>
							<div class="flex items-center gap-2">
								<UButton
									color="primary"
									size="2xs"
									variant="link"
									icon="i-lucide-pencil"
									@click="caseModal(item.id)"
								/>
							</div>
						</div>
					</template> -->
				</UCard>
			</div>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="i in 3" :key="i">
				<UCard
					:ui="{
						header: { padding: 'px-4 py-3 sm:p-4' },
						body: { padding: 'px-4 py-3 sm:p-4' },
						footer: { padding: 'px-4 py-3 sm:p-4' }
					}"
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
							<div class="text-sm text-gray-500">
								<USkeleton class="w-1/2 h-6" />
							</div>
							<div class="flex items-center gap-2">
								<USkeleton width="w-1/2 h-6" />
							</div>
						</div>
					</template> -->
				</UCard>
			</div>
		</div>
	</div>
</template>
