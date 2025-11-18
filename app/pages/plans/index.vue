<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import BaseCard from "~/components/cards/BaseCard.vue"

const supabase = useSupabaseClient<Database>()

type TestPlan = Tables<"test_plans">

const plans = ref<TestPlan[]>([])

async function getPlans() {
	const { data, error } = await supabase.from("test_plans").select("*")
	if (error) {
		console.error(error)
		return
	}
	plans.value = data
	console.log(plans.value)
}

getPlans()

useHead({
	title: `Test Plans | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<h1 class="text-3xl font-bold text-primary">Test Plans</h1>
		<div
			v-if="plans.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="item in plans" :key="item.id">
				<BaseCard>
					<template #header>
						<!-- <div class="font-bold text-primary-500">
							{{ item.title }}
						</div> -->
						<NuxtLink
							class="font-bold text-primary hover:underline"
							:to="'/plans/' + item.id"
						>
							{{ item.title }}
						</NuxtLink>
					</template>
					<template #default>
						<span v-if="item.description" class="line-clamp-1 text-ellipsis">{{
							item.description
						}}</span>
						<div v-else class="opacity-50">No description</div>
					</template>
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-neutral-500">
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
				</BaseCard>
			</div>
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
								<	USkeleton width="w-1/2 h-6" />
							</div>
						</div>
					</template> -->
				</BaseCard>
			</div>
		</div>
	</div>
</template>
