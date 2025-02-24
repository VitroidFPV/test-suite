<script setup lang="ts">
import type { Database, Tables } from "~/database.types"

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

type Run = Tables<"test_runs">
type NewRun = Run
type TestPlan = Tables<"test_plans">

const runs = ref<Run[]>([])
const testPlans = ref<TestPlan[]>([])
const runGroups = ref<RunGroup[]>([])

async function getRuns() {
	const { data, error } = await supabase.from("test_runs").select("*")
	if (error) {
		console.error(error)
		return
	}
	runs.value = data || []
}

const selectedRunGroup = ref<RunGroup>()
const selectedTestPlan = ref<TestPlan>()

const user = useSupabaseUser()

const newRun = ref<NewRun>({
	id: crypto.randomUUID(),
	title: "",
	created_at: new Date().toDateString(),
	created_by: user.value?.id || "",
	group: "",
	plan: ""
})

function selectGroup(group: RunGroup) {
	newRun.value.group = group.id
	console.log(newRun.value)
}

async function selectPlan(plan: TestPlan) {
	newRun.value.plan = plan.id
	console.log(newRun.value)
}

function autoFill() {
	newRun.value.title = `${selectedRunGroup.value?.title} - ${selectedTestPlan.value?.title}`
}

async function getRunGroups() {
	const { data, error } = await supabase.from("test_run_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	runGroups.value = data || []

	console.log(runGroups.value)
}

async function getTestPlans() {
	const { data, error } = await supabase.from("test_plans").select("*")
	if (error) {
		console.error(error)
		return
	}
	testPlans.value = data || []
}

getRuns()
getRunGroups()
getTestPlans()

const createRunModalOpen = ref(false)

function openCreateRunModal() {
	createRunModalOpen.value = true
}

async function createRun() {
	const { data, error } = await supabase
		.from("test_runs")
		.insert([newRun.value])
	if (error) {
		console.error(error)
		return
	}

	createRunModalOpen.value = false

	getRuns()
}

const { metaSymbol } = useShortcuts()

useHead({
	title: `Test Runs | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex w-full justify-between">
			<div class="flex flex-col gap-y-6">
				<h1 class="text-3xl font-bold text-primary">Test Runs</h1>
				<div class="flex flex-col lg:flex-row gap-3 w-full">
					<!-- <div v-if="plan">
						<h1 class="text-6xl font-bold text-primary mb-8">
							{{ plan?.title }}
						</h1>
						<div class="md">
							<VueMarkdown
								v-if="plan.description"
								:options="options"
								:source="plan.description"
							>
							</VueMarkdown>
						</div>
					</div> -->
				</div>
			</div>
			<div class="flex flex-col">
				<UButton
					color="primary"
					size="sm"
					variant="solid"
					icon="i-lucide-plus"
					@click="openCreateRunModal"
				>
					New Test Run
				</UButton>
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
						<!-- <div class="font-bold text-primary-500">
							{{ item.title }}
						</div> -->
						<NuxtLink :to="`/runs/${item.id}`">
							<div class="font-bold text-primary hover:underline">
								{{ item.title }}
							</div>
						</NuxtLink>
					</template>
					<!-- <template #default>
						<span v-if="item.title" class="line-clamp-1 text-ellipsis">{{
							item.title
						}}</span>
						<div v-else class="opacity-50">No description</div>
					</template> -->
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

		<UModal
			v-model="createRunModalOpen"
			:ui="{
				base: '!max-w-full 2xl:mx-64 xl:mx-32 lg:mx-32 md:mx-16 mx-0 sm:mx-8'
			}"
		>
			<UCard
				:ui="{
					header: { padding: 'px-4 py-3 sm:p-4' },
					body: { padding: 'px-4 py-3 sm:p-4' },
					footer: { padding: 'px-4 py-3 sm:p-4' }
				}"
			>
				<template #header>
					<div class="flex flex-col gap-y-3">
						<UButtonGroup>
							<UInput
								v-model="newRun.title!"
								placeholder="Run Title"
								color="gray"
								class="w-full"
							/>
							<UTooltip text="Automatic Fill (requires Plan and Group)">
								<UButton
									color="gray"
									icon="i-lucide-pencil"
									:disabled="!selectedRunGroup || !selectedTestPlan"
									@click="autoFill"
								/>
							</UTooltip>
						</UButtonGroup>
						<div class="flex gap-x-3">
							<div class="flex flex-col gap-y-2 w-full">
								<div class="flex items-center gap-x-1 text-gray-400 text-sm">
									<UIcon name="i-lucide-book-check" class="h-4 w-4" />
									Test Plan
								</div>
								<USelectMenu
									v-model="selectedTestPlan"
									searchable
									search-placeholder="Search for a plan"
									placeholder="Select a plan"
									:options="testPlans"
									class="w-full relative"
									option-attribute="title"
									@change="selectedTestPlan && selectPlan(selectedTestPlan)"
								>
									<template #option="{ option }">
										<div class="flex items-center gap-2">
											<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
											{{ option.title }}
										</div>
									</template>
								</USelectMenu>
							</div>

							<UDivider orientation="vertical" />

							<div class="flex flex-col gap-y-2 w-full">
								<div class="flex items-center gap-x-1 text-gray-400 text-sm">
									<UIcon name="i-lucide-library-big" class="h-4 w-4" />
									Run Group
								</div>
								<USelectMenu
									v-model="selectedRunGroup"
									searchable
									search-placeholder="Search for a group"
									placeholder="Select a group"
									:options="runGroups"
									class="w-full relative"
									option-attribute="title"
									@change="selectedRunGroup && selectGroup(selectedRunGroup)"
								>
									<template #option="{ option }">
										<div class="flex items-center gap-2">
											<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
											{{ option.title }}
										</div>
									</template>
								</USelectMenu>
							</div>
						</div>
					</div>
				</template>
				<template #default>
					<!-- grid of all case titles -->
					<div class="flex flex-col gap-y-3">
						<div class="flex flex-col gap-y-3">
							<div class="font-bold text-primary-500 flex items-center gap-2">
								<!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
								<!-- {{ group.group }} -->
							</div>
							<div
								class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
							>
								<!-- <UCard
									v-for="item in group.cases"
									:key="item.id"
									:ui="{
										header: { padding: 'px-4 py-3 sm:p-4' },
										body: { padding: 'px-4 py-3 sm:p-4' },
										footer: { padding: 'px-4 py-3 sm:p-4' },
										base: 'h-full outline outline-2 outline-transparent duration-100'
									}"
									:class="{
										'outline-primary-500/50': selectedCases.includes(item.id)
									}"
									@click="selectCase(item.id)"
								>
									{{ item.title }}
								</UCard> -->
							</div>
						</div>
					</div>
				</template>
				<template #footer>
					<div class="flex items-center gap-2 h-fit w-full justify-end">
						<UButton
							color="primary"
							size="sm"
							variant="solid"
							icon="i-lucide-plus"
							@click="createRun"
						>
							Create Run
						</UButton>
					</div>
				</template>
			</UCard>
		</UModal>
	</div>
</template>
