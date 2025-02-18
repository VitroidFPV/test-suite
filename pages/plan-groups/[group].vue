<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

const route = useRoute()

const supabase = useSupabaseClient<Database>()
type PlanGroup = Tables<"test_plan_groups">

const planGroup = ref<PlanGroup>()

// slug group is id
async function getPlanGroup() {
	const { data, error } = await supabase
		.from("test_plan_groups")
		.select("*")
		.eq("id", route.params.group)
	if (error) {
		console.error(error)
		return
	}
	planGroup.value = data[0]
}

getPlanGroup()
getPlans()
</script>

<template>
	<div class="flex flex-col lg:flex-row gap-3 w-full">
		<div v-if="planGroup">
			<h1 class="text-4xl font-bold text-primary mb-8">
				{{ planGroup?.title }}
			</h1>
			<div class="md">
				<VueMarkdown
					v-if="planGroup.description"
					:options="options"
					:source="planGroup.description"
				>
				</VueMarkdown>
			</div>
		</div>
	</div>
</template>
