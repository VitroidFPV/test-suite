<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"

const options: typeof Options = {
	html: true
}

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

const runGroups = ref<RunGroup[]>([])

async function getPlans() {
	const { data, error } = await supabase.from("test_run_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	runGroups.value = data
}

getPlans()

useHead({
	title: `Run Groups | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Run Groups</h1>
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
