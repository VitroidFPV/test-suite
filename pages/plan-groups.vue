<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const supabase = useSupabaseClient<Database>()

type PlanGroup = Tables<"test_plan_groups">

const planGroups = ref<PlanGroup[]>([])

async function getPlans() {
	const { data, error } = await supabase.from("test_plan_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	planGroups.value = data
}

onMounted(() => {
	getPlans()
})
</script>

<template>
	<div class="flex flex-col lg:flex-row gap-3 w-full">
		<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
			<div v-for="plan in planGroups" :key="plan.id">
				<UCard
					:ui="{
						header: { padding: 'px-4 py-3 sm:p-4' },
						body: { padding: 'px-4 py-3 sm:p-4' },
						footer: { padding: 'px-4 py-3 sm:p-4' }
					}"
				>
					<template #header>
						<NuxtLink
							class="font-bold text-primary hover:underline"
							:to="'group-' + plan.id"
						>
							{{ plan.title }}
						</NuxtLink>
					</template>
					<template #default>
						<!-- <span v-if="plan.description" class="line-clamp-1 text-ellipsis">{{
							
						}}</span> -->
						<!-- <div v-else class="opacity-50">No description</div> -->
						<div class="md">
							<VueMarkdown
								v-if="plan.description"
								:options="options"
								:source="plan.description"
							>
							</VueMarkdown>
						</div>
					</template>
				</UCard>
			</div>
		</div>
	</div>
</template>
