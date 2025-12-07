<script setup lang="ts">
import type { Database } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"

const supabase = useSupabaseClient<Database>()

const { data: plans, error } = await useAsyncData(
	"plans",
	async () => {
		const { data, error } = await supabase.from("test_plans").select("*")
		if (error) {
			console.error(error)
			return []
		}
		return data
	},
	{ lazy: true }
)

useHead({
	title: `Test Plans | Test Suite`
})

// Create plan modal
const createPlanModalOpen = ref(false)
const mdPreviewMode = ref(false)
const newPlanTitle = ref("")
const newPlanDescription = ref("")

watch(createPlanModalOpen, (isOpen) => {
	if (!isOpen) {
		newPlanTitle.value = ""
		newPlanDescription.value = ""
		mdPreviewMode.value = false
	}
})

async function createPlan() {
	if (!newPlanTitle.value.trim()) {
		return
	}

	const { data, error } = await supabase
		.from("test_plans")
		.insert({
			title: newPlanTitle.value,
			description: newPlanDescription.value
		})
		.select()

	if (error) {
		console.error(error)
		return
	}

	createPlanModalOpen.value = false

	// Navigate to the new plan
	if (data && data[0]) {
		navigateTo(`/plans/${data[0].id}`)
	}
}
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Test Plans"
	>
		<template #title-trailing>
			<UModal
				v-model:open="createPlanModalOpen"
				title="Create Test Plan"
				description="Create a new test plan with a title and description"
				:ui="{
					content: 'max-w-2xl',
					title: 'text-primary'
				}"
			>
				<UTooltip text="Create Test Plan">
					<UButton
						color="primary"
						size="sm"
						variant="soft"
						icon="i-lucide-plus"
					>
						New Plan
					</UButton>
				</UTooltip>
				<template #body>
					<div class="flex flex-col gap-3">
						<textarea
							v-model="newPlanTitle"
							placeholder="Plan Title"
							class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal bg-neutral-800"
						/>
						<!-- Description with markdown preview -->
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<span class="text-sm text-neutral-400">Description</span>
								<USwitch v-model="mdPreviewMode" label="Markdown Preview" />
							</div>
							<UTextarea
								v-if="!mdPreviewMode"
								v-model="newPlanDescription"
								color="primary"
								placeholder="Plan Description (supports Markdown)"
								variant="soft"
								:rows="4"
								autoresize
							/>
							<div
								v-if="mdPreviewMode"
								class="md min-h-24 p-3 rounded-lg bg-neutral-800"
							>
								<VueMarkdown
									v-if="newPlanDescription"
									:source="newPlanDescription"
								/>
								<span v-else class="text-neutral-500">No description</span>
							</div>
						</div>
					</div>
				</template>
				<template #footer>
					<div class="flex items-center justify-end w-full">
						<UButton
							color="primary"
							size="sm"
							variant="solid"
							icon="i-lucide-plus"
							:disabled="!newPlanTitle.trim()"
							@click="createPlan"
						>
							Create Plan
						</UButton>
					</div>
				</template>
			</UModal>
		</template>
		<template #content>
			<div
				v-if="plans !== null"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="item in plans" :key="item.id">
					<BaseCard>
						<template #header>
							<NuxtLink
								class="font-bold text-primary hover:underline"
								:to="'/plans/' + item.id"
							>
								{{ item.title }}
							</NuxtLink>
						</template>
						<template #default>
							<span
								v-if="item.description"
								class="line-clamp-1 text-ellipsis"
								>{{ item.description }}</span
							>
							<div v-else class="opacity-50">No description</div>
						</template>
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
					</BaseCard>
				</div>
			</div>
			<div v-if="plans && plans.length == 0">
				No test plans yet. Click "Create Plan" to create a new plan.
			</div>
		</template>
	</PageWrapper>
</template>
