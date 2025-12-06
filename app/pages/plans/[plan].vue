<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"

const supabase = useSupabaseClient<Database>()

type TestPlan = Tables<"test_plans">
type TestPlanCase = Tables<"test_plan_case_links">
type TestCase = Tables<"test_cases">

const plan = ref<TestPlan>()
const planCases = ref<TestPlanCase[]>([])
const cases = ref<TestCase[]>([])
const allCases = ref<TestCase[]>([])
const groupedCases = ref<{ group: string; cases: TestCase[] }[]>([])

const urlPlan = useRoute().params.plan as string

// get plan from url
async function getPlan() {
	const { data, error } = await supabase
		.from("test_plans")
		.select("*")
		.eq("id", urlPlan)
	if (error) {
		console.error(error)
		return
	}
	plan.value = data[0]

	useHead({
		title: `${plan.value?.title} | Test Plans | Test Suite`
	})

	planTitle.value = plan.value?.title ?? ""
	planDescription.value = plan.value?.description ?? ""
}

// get plan cases
async function getPlanCases() {
	const { data, error } = await supabase
		.from("test_plan_case_links")
		.select("*")
		.eq("plan", urlPlan)
	if (error) {
		console.error(error)
		return
	}
	planCases.value = data

	const caseIds = planCases.value.map((link) => link.case)

	const { data: casesData, error: casesError } = await supabase
		.from("test_cases")
		.select("*")
		.in("id", caseIds)
	if (casesError) {
		console.error(casesError)
		return
	}
	cases.value = casesData

	selectedCases.value = caseIds
}

async function getAllCases() {
	const { data: casesData, error: casesError } = await supabase
		.from("test_cases")
		.select("*")

	if (casesError) {
		console.error(casesError)
		return
	}

	const { data: groupingsData, error: groupingsError } = await supabase
		.from("test_case_group_links")
		.select("*")

	if (groupingsError) {
		console.error(groupingsError)
		return
	}

	allCases.value = casesData

	// get groups from db
	const groupIds = groupingsData.map((link) => link.group)
	const { data: groupsData, error: groupsError } = await supabase
		.from("test_case_groups")
		.select("*")
		.in("id", groupIds)

	if (groupsError) {
		console.error(groupsError)
		return
	}

	// group cases by group
	groupedCases.value = groupsData.map((group) => ({
		group: group.title,
		cases: casesData.filter((c) =>
			groupingsData
				.filter((link) => link.group === group.id)
				.map((link) => link.case)
				.includes(c.id)
		)
	}))

	// add ungrouped cases
	const groupedCaseIds = groupedCases.value.flatMap((group) =>
		group.cases.map((c) => c.id)
	)
	const ungrouped = casesData.filter((c) => !groupedCaseIds.includes(c.id))
	if (ungrouped.length > 0) {
		groupedCases.value.push({
			group: "Ungrouped",
			cases: ungrouped
		})
	}
}

const planCaseModalOpen = ref(false)
const mdPreviewMode = ref(false)

function planCaseModal() {
	planCaseModalOpen.value = true
}

// selected cases as an array of uids
const selectedCases = ref<string[]>([])
const planTitle = ref("")
const planDescription = ref("")

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
		return
	}

	getPlanCases()
	getPlan()
}

const deletePlanModalOpen = ref(false)

async function deletePlan() {
	const { error } = await supabase.from("test_plans").delete().eq("id", urlPlan)
	if (error) {
		console.error(error)
		return
	}

	deletePlanModalOpen.value = false

	navigateTo("/plans")
}

getPlan()
getPlanCases()
getAllCases()
</script>

<template>
	<PageWrapper
		:breadcrumbs="[
			{ label: 'Dashboard', to: '/' },
			{ label: 'Test Plans', to: '/plans' }
		]"
		:title="plan?.title ?? null"
		:loading="!plan"
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
					<UTooltip text="Edit Plan">
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-pencil"
							:disabled="!plan"
							@click="planCaseModal()"
						>
							<!-- Edit Plan -->
						</UButton>
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
								<UTooltip
									text="Save & Close"
									:shortcuts="['meta', 'Shift', 'S']"
								>
									<UButton
										color="primary"
										size="sm"
										variant="link"
										icon="i-lucide-save-all"
										@click="savePlan"
									/>
								</UTooltip>
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
						>
							<!-- Delete Test Plan -->
						</UButton>
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
			<div v-if="plan" class="md mt-4 text-neutral-400">
				<VueMarkdown v-if="plan.description" :source="plan.description">
				</VueMarkdown>
			</div>
		</template>

		<template #content>
			<div class="w-full flex gap-x-3"></div>
			<div
				v-if="plan"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="item in cases" :key="item.id">
					<BaseCard>
						<template #header>
							<div class="font-bold text-primary-500">
								{{ item.title }}
							</div>
						</template>
						<template #default>
							<span v-if="item.text" class="line-clamp-1 text-ellipsis">{{
								item.text
							}}</span>
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
			<div v-if="plan && cases.length == 0">
				No test cases in this plan. Click "Edit Plan" to add cases.
			</div>
		</template>
	</PageWrapper>
</template>
