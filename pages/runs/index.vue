<script setup lang="ts">
import type { Database, Tables } from "~/database.types"

const supabase = useSupabaseClient<Database>()

type RunGroup = Tables<"test_run_groups">

type Run = Tables<"test_runs">
type NewRun = Run & { run_group_id?: string }

const selectedRunGroup = ref<RunGroup>()

const user = useSupabaseUser()

const newRun = ref<NewRun>({
	id: crypto.randomUUID(),
	title: "",
	created_at: new Date().toDateString(),
	created_by: user.value?.id || "",
	run_group_id: ""
})

function selectGroup(group: RunGroup) {
	newRun.value.run_group_id = group.id
	console.log(newRun.value)
}

const runGroups = ref<RunGroup[]>([])

async function getRunGroups() {
	const { data, error } = await supabase.from("test_run_groups").select("*")
	if (error) {
		console.error(error)
		return
	}
	runGroups.value = data || []

	console.log(runGroups.value)
}

getRunGroups()

const createRunModalOpen = ref(false)

function openCreateRunModal() {
	createRunModalOpen.value = true
}

async function createRun() {
	const runWithoutGroup = { ...newRun.value }
	delete runWithoutGroup.run_group_id

	const { data, error } = await supabase
		.from("test_runs")
		.insert([runWithoutGroup])
	if (error) {
		console.error(error)
		return
	}

	// create link between run and group
	if (newRun.value.run_group_id) {
		const { error } = await supabase.from("test_run_group_links").insert([
			{
				run: newRun.value.id,
				run_group: newRun.value.run_group_id
			}
		])
		if (error) {
			console.error(error)
			return
		}
	}
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
				<UTooltip text="Create new Test Run">
					<UButton
						color="primary"
						size="sm"
						variant="solid"
						icon="i-lucide-plus"
						@click="openCreateRunModal"
					>
						New Test Run
					</UButton>
				</UTooltip>
			</div>
		</div>

		<UDivider />

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
						<textarea
							v-if="newRun"
							v-model="newRun.title"
							placeholder="Run Title"
							color="primary"
							variant="none"
							class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal bg-gray-800 h-fit"
						/>
						<div class="flex">
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
					<div class="flex items-center justify-between">
						<UTooltip text="Delete" :shortcuts="[metaSymbol, 'Delete']">
							<UButton
								color="red"
								size="sm"
								variant="link"
								icon="i-lucide-trash"
							/>
						</UTooltip>
						<div class="flex items-center gap-2 h-fit">
							<UTooltip text="Save" :shortcuts="[metaSymbol, 'S']">
								<UButton
									color="primary"
									size="sm"
									variant="link"
									icon="i-lucide-save"
								/>
							</UTooltip>
							<UTooltip
								text="Save & Close"
								:shortcuts="[metaSymbol, 'Shift', 'S']"
							>
								<UButton
									color="primary"
									size="sm"
									variant="link"
									icon="i-lucide-save-all"
									@click="createRun"
								/>
							</UTooltip>
						</div>
					</div>
				</template>
			</UCard>
		</UModal>
	</div>
</template>
