<script setup lang="ts">
import type { Database } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"

const toast = useToast()
const supabase = useSupabaseClient<Database>()

const urlPlan = useRoute().params.plan as string

// Fetch plan details
const {
	data: plan,
	error: planError,
	refresh: refreshPlan
} = await useAsyncData(
	`plan-${urlPlan}`,
	async () => {
		const { data, error } = await supabase
			.from("test_plans")
			.select("*")
			.eq("id", urlPlan)
			.is("deleted_at", null)
			.single()
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

// Fetch plan case links and their associated cases
const {
	data: planCasesData,
	error: planCasesError,
	refresh: refreshPlanCases
} = await useAsyncData(
	`planCases-${urlPlan}`,
	async () => {
		const { data: linksData, error: linksError } = await supabase
			.from("test_plan_case_links")
			.select("*")
			.eq("plan", urlPlan)
		if (linksError) {
			throw createSupabaseError(linksError)
		}

		const caseIds = linksData.map((link) => link.case)

		if (caseIds.length === 0) {
			return { links: linksData, cases: [] }
		}

		const { data: casesData, error: casesError } = await supabase
			.from("test_cases")
			.select("*")
			.in("id", caseIds)
			.is("deleted_at", null)
		if (casesError) {
			throw createSupabaseError(casesError)
		}

		return { links: linksData, cases: casesData }
	},
	{ lazy: true }
)

// Computed properties for cases and selected case IDs
// Return undefined while loading to distinguish from empty
const cases = computed(() => planCasesData.value?.cases)
const planCaseIds = computed(
	() => planCasesData.value?.links.map((link) => link.case) ?? []
)

// Fetch all cases grouped for the modal
const {
	data: groupedCases,
	error: groupedCasesError,
	refresh: refreshGroupedCases
} = await useAsyncData(
	"allGroupedCases",
	async () => {
		const { data: casesData, error: casesError } = await supabase
			.from("test_cases")
			.select("*")
			.is("deleted_at", null)

		if (casesError) {
			throw createSupabaseError(casesError)
		}

		const { data: groupingsData, error: groupingsError } = await supabase
			.from("test_case_group_links")
			.select("*")

		if (groupingsError) {
			throw createSupabaseError(groupingsError)
		}

		// get groups from db
		const groupIds = [...new Set(groupingsData.map((link) => link.group))]

		if (groupIds.length === 0) {
			// All cases are ungrouped
			return [{ group: "Ungrouped", cases: casesData }]
		}

		const { data: groupsData, error: groupsError } = await supabase
			.from("test_case_groups")
			.select("*")
			.in("id", groupIds)
			.is("deleted_at", null)

		if (groupsError) {
			throw createSupabaseError(groupsError)
		}

		// group cases by group
		const grouped = groupsData.map((group) => ({
			group: group.title,
			cases: casesData.filter((c) =>
				groupingsData
					.filter((link) => link.group === group.id)
					.map((link) => link.case)
					.includes(c.id)
			)
		}))

		// add ungrouped cases
		const groupedCaseIds = grouped.flatMap((g) => g.cases.map((c) => c.id))
		const ungrouped = casesData.filter((c) => !groupedCaseIds.includes(c.id))
		if (ungrouped.length > 0) {
			grouped.push({
				group: "Ungrouped",
				cases: ungrouped
			})
		}

		return grouped
	},
	{ lazy: true }
)

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (planError.value) errors.push(planError.value)
	if (planCasesError.value) errors.push(planCasesError.value)
	if (groupedCasesError.value) errors.push(groupedCasesError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([refreshPlan(), refreshPlanCases(), refreshGroupedCases()])
}

const planCaseModalOpen = ref(false)
const mdPreviewMode = ref(false)

// selected cases as an array of uids - initialized from planCaseIds when modal opens
const selectedCases = ref<string[]>([])
const planTitle = ref("")
const planDescription = ref("")

// Initialize form values when plan loads
watch(
	plan,
	(newPlan) => {
		if (newPlan) {
			planTitle.value = newPlan.title ?? ""
			planDescription.value = newPlan.description ?? ""
		}
	},
	{ immediate: true }
)

// Sync selected cases when plan cases load
watch(
	planCaseIds,
	(newIds) => {
		selectedCases.value = [...newIds]
	},
	{ immediate: true }
)

useStablePageTitle({
	title: computed(() => {
		const title = plan.value?.title?.trim()
		return title ? `${title} | Test Plans | Test Suite` : ""
	}),
	ready: computed(() => Boolean(plan.value?.title?.trim()))
})

function selectCase(id: string) {
	if (selectedCases.value.includes(id)) {
		selectedCases.value = selectedCases.value.filter((i) => i !== id)
	} else {
		selectedCases.value = [...selectedCases.value, id]
	}
}

// write selected cases to plan
async function savePlan() {
	const { error } = await supabase
		.from("test_plan_case_links")
		.delete()
		.eq("plan", urlPlan)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	const insertData = selectedCases.value.map((id) => ({
		plan: urlPlan,
		case: id
	}))

	const { error: insertDataError } = await supabase
		.from("test_plan_case_links")
		.insert(insertData)
	if (insertDataError) {
		console.error(insertDataError)
		toast.add({
			title: "Error",
			description: insertDataError.message,
			color: "error"
		})
		return
	}

	planCaseModalOpen.value = false

	// write plan title and description
	const { error: updateError } = await supabase
		.from("test_plans")
		.update({
			title: planTitle.value,
			description: planDescription.value
		})
		.eq("id", urlPlan)
	if (updateError) {
		console.error(updateError)
		toast.add({
			title: "Error",
			description: updateError.message,
			color: "error"
		})
		return
	}

	await Promise.all([refreshPlanCases(), refreshPlan()])
}

const deletePlanModalOpen = ref(false)

async function deletePlan() {
	const { error } = await supabase
		.from("test_plans")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", urlPlan)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	deletePlanModalOpen.value = false

	navigateTo("/plans")
}

defineShortcuts({
	shift_e: {
		handler: () => {
			if (plan.value && groupedCases.value) {
				planCaseModalOpen.value = true
			}
		}
	}
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[
			{ label: 'Dashboard', to: '/' },
			{ label: 'Test Plans', to: '/plans' }
		]"
		:title="plan?.title ?? null"
		:loading="!plan && !pageError"
		:error="pageError"
		back-link="/plans"
		@retry="retryAll"
	>
		<template #title-trailing>
			<div class="flex gap-2">
				<UModal
					v-model:open="planCaseModalOpen"
					title="Edit Plan"
					description="Edit the plan title, description and cases"
					:ui="{
						content: 'max-w-6xl',
						title: 'text-primary'
					}"
				>
					<UTooltip text="Edit Plan" :kbds="['shift', 'E']">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							:disabled="!plan || !groupedCases"
						/>
					</UTooltip>
					<template #body>
						<div class="flex flex-col gap-3">
							<textarea
								v-if="plan"
								v-model="planTitle"
								placeholder="Plan Title"
								color="primary"
								variant="none"
								class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal bg-neutral-800"
							/>
							<!-- Description with markdown preview -->
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<span class="text-sm text-neutral-400">Description</span>
									<USwitch v-model="mdPreviewMode" label="Markdown Preview" />
								</div>
								<UTextarea
									v-if="!mdPreviewMode && plan"
									v-model="planDescription"
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
										v-if="planDescription"
										:source="planDescription"
									/>
									<span v-else class="text-neutral-500">No description</span>
								</div>
							</div>
							<!-- grid of all case titles -->
							<div class="flex flex-col gap-y-3">
								<div
									v-for="group in groupedCases"
									:key="group.group"
									class="flex flex-col gap-y-3"
								>
									<div
										class="font-bold text-primary-500 flex items-center gap-2"
									>
										<UIcon
											:name="
												group.group === 'Ungrouped'
													? 'i-lucide-folder-open'
													: 'i-lucide-folder'
											"
											class="h-4 w-4"
										/>
										{{ group.group }}
									</div>
									<div
										class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
									>
										<BaseCard
											v-for="item in group.cases"
											:key="item.id"
											:class="{
												'outline-2 outline-primary-500/50':
													selectedCases.includes(item.id),
												'outline-2 outline-transparent':
													!selectedCases.includes(item.id),
												'h-full duration-100 cursor-pointer': true
											}"
											@click="selectCase(item.id)"
										>
											{{ item.title }}
										</BaseCard>
									</div>
								</div>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex items-center justify-end w-full">
							<div class="flex items-center gap-2 h-fit">
								<UButton
									color="primary"
									size="sm"
									variant="soft"
									icon="i-lucide-save-all"
									loading-auto
									@click="savePlan"
									>Apply</UButton
								>
							</div>
						</div>
					</template>
				</UModal>
				<UModal
					v-model:open="deletePlanModalOpen"
					title="Delete Test Plan"
					description="Are you sure you want to delete this test plan? This action cannot be undone."
					:ui="{
						title: 'text-error'
					}"
				>
					<UTooltip text="Delete Test Plan">
						<UButton
							color="error"
							size="sm"
							variant="soft"
							icon="i-lucide-trash"
						/>
					</UTooltip>
					<template #footer>
						<div class="flex gap-3 justify-end w-full">
							<UButton
								color="neutral"
								size="sm"
								variant="soft"
								@click="deletePlanModalOpen = false"
								>Cancel</UButton
							>
							<UButton
								color="error"
								size="sm"
								variant="solid"
								icon="i-lucide-trash"
								loading-auto
								@click="deletePlan"
							>
								Delete Test Plan
							</UButton>
						</div>
					</template>
				</UModal>
			</div>
		</template>

		<template #description>
			<div v-if="plan" class="md text-neutral-400">
				<VueMarkdown v-if="plan.description" :source="plan.description">
				</VueMarkdown>
			</div>
		</template>

		<template #content>
			<!-- Cases loaded with items -->
			<div
				v-if="plan && cases && cases.length > 0"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="item in cases" :key="item.id" class="h-full">
					<BaseCard class="h-full">
						<template #header>
							<div class="font-bold text-primary-500">
								{{ item.title }}
							</div>
						</template>
						<template #default>
							<span v-if="item.text" class="line-clamp-2 text-ellipsis">{{
								item.text
							}}</span>
							<div v-else class="opacity-50">No description</div>
						</template>
					</BaseCard>
				</div>
			</div>
			<!-- Loading state: plan or cases still loading -->
			<div
				v-else-if="!plan || !cases"
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
			<!-- Empty state: both loaded but no cases -->
			<div v-else class="text-neutral-500">
				No test cases in this plan. Click "Edit Plan" to add cases.
			</div>
		</template>
	</PageWrapper>
</template>
