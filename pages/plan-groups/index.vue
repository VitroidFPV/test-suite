<script setup lang="ts">
import type { Database, Tables } from "~/database.types"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"
import type { BreadcrumbLink } from "#ui/types"

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

await getPlans()

definePageMeta({
	breadcrumb: {
		label: "Plan Groups",
		icon: "i-lucide-library-big"
	} as BreadcrumbLink
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Plan Groups</h1>
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
								:to="'/plan-groups/' + plan.id"
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
					</UCard>
				</div>
			</div>
		</div>
	</div>
</template>
