<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import { useRoute } from "vue-router"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"
import type { BreadcrumbLink } from "#ui/types"

const options: typeof Options = {
	html: true
}

const route = useRoute()
// console.log(route.params.group)

const supabase = useSupabaseClient<Database>()
type PlanGroup = Tables<"test_plan_groups">

const planGroup = ref<PlanGroup | null>(null)

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

onMounted(() => {
	getPlanGroup()
})

const breadcrumbs = ref<BreadcrumbLink[]>([])
watch(planGroup, () => {
	if (planGroup.value) {
		breadcrumbs.value = [
			{
				label: "Home",
				to: "/",
				icon: "i-lucide-home"
			},
			{
				label: "Plan Groups",
				to: "/plan-groups",
				icon: "i-lucide-library-big"
			},
			{
				label: planGroup.value.title || "",
				to: "",
				icon: "i-lucide-library-big"
			}
		]
	}
})
</script>

<template>
	<div class="flex flex-col lg:flex-row gap-3 w-full">
		<div v-if="planGroup">
			<div class="mb-4">
				<UBreadcrumb :links="breadcrumbs">
					<template #default="{ link, isActive }">
						<div :class="{ 'font-bold': isActive }">{{ link.label }}</div>
					</template>
				</UBreadcrumb>
			</div>
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
