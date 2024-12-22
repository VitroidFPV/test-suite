<script setup lang="ts">
import dayjs from "dayjs"
import type { Database, Tables } from "~/database.types"

const supabase = useSupabaseClient<Database>()

type Case = Tables<"cases">
type CaseGroup = Tables<"case_groups">
type GroupedCase = Tables<"grouped_cases">

const cases = ref<Case[]>([])
const caseGroups = ref<CaseGroup[]>([])
const selectedGroup = ref<CaseGroup>()
const groupedCases = ref<GroupedCase[]>([])

async function getAllCases() {
	const { data: casesData, error: casesError } = await supabase
		.from("cases")
		.select("*")

	if (casesError) {
		console.error(casesError)
		return
	}

	const { data: groupingsData, error: groupingsError } = await supabase
		.from("grouped_cases")
		.select("*")

	if (groupingsError) {
		console.error(groupingsError)
		return
	}

	cases.value = casesData
	groupedCases.value = groupingsData
}

async function getCaseGroups() {
	const { data, error } = await supabase.from("case_groups").select("*")
	if (error) {
		console.error(error)
	} else {
		data.sort((a, b) => a.name.localeCompare(b.name))
		caseGroups.value = data
	}
}

// Filter cases by selected group
const filteredCases = computed(() => {
	if (!selectedGroup.value || selectedGroup.value.name === "all") {
		return cases.value
	}

	const groupedCaseIds = groupedCases.value
		.filter((gc) => gc.group === selectedGroup.value?.id)
		.map((gc) => gc.case)

	return cases.value.filter((c) => groupedCaseIds.includes(c.id))
})

onMounted(() => {
	getAllCases()
	getCaseGroups()
})

const groups = computed(() => [
	{ label: "All", value: "all" },
	...caseGroups.value.map((item) => ({
		label: item.title,
		value: item.name
	}))
])

let selectedTabGroup: number = 0

function filterGroup(index: number) {
	selectedGroup.value = caseGroups.value[index - 1]
	selectedTabGroup = index
	editedGroup.value = selectedGroup.value
}

const caseModalOpen = ref(false)
const editedCase = ref<Case>()

function caseModal(id: string) {
  caseModalOpen.value = true
  editedCase.value = id
    ? JSON.parse(JSON.stringify(cases.value.find((item) => item.id === id)))
    : {
        case_id: 1,
        title: "",
        text: "",
        created_at: new Date().toISOString(),
        id: ""
      }
}

async function writeCase(data: Case, update: boolean = false) {
	if (update) {
		const { error } = await supabase
			.from("cases")
			.update({
				title: data.title,
				text: data.text,
				case_id: data.case_id,
				created_at: data.created_at
			})
			.eq("id", data.id)
		if (error) {
			console.error(error)
			return
		}
	} else {
		const { data: newCase, error } = await supabase
			.from("cases")
			.insert([
				{
					title: data.title,
					text: data.text,
					created_at: data.created_at
				}
			])
			.select()
			.single()
		if (error) {
			console.error(error)
			return
		}

		// Add case to current group if one is selected
		if (selectedGroup.value && selectedGroup.value.id) {
			const { error: groupError } = await supabase
				.from("grouped_cases")
				.insert([
					{
						case: newCase.id,
						group: selectedGroup.value.id
					}
				])
			if (groupError) {
				console.error(groupError)
			}
		}
	}
	await getAllCases()
}

function saveCase(close: boolean = false, update: boolean = false) {
	if (editedCase.value) {
		console.log(editedCase.value)
		writeCase(editedCase.value, update)
		if (close) {
			caseModalOpen.value = false
		}
	}
}

async function deleteCase(id: string) {
	const { error } = await supabase.from("cases").delete().match({ id })
	if (error) {
		console.error(error)
	}
	caseModalOpen.value = false
	getAllCases()
}

const linkModalOpen = ref(false)
async function groupModal(id: string) {
  linkModalOpen.value = true
  
  if (id) {
    // Load existing group
    const group = caseGroups.value.find(item => item.id === id)
    if (!group) return
    
    editedGroup.value = JSON.parse(JSON.stringify(group))
    
    // Load associated cases
    const groupCases = groupedCases.value
      .filter(gc => gc.group === id)
      .map(gc => gc.case)
    
    selectedCases.value = groupCases
  } else {
    // New group
    editedGroup.value = {
      title: "",
      created_at: new Date().toISOString(),
      id: "",
      name: ""
    }
    selectedCases.value = []
  }
}

const selectedCases = ref<string[]>([])

function selectCase(id: string) {
  if (selectedCases.value.includes(id)) {
    selectedCases.value = selectedCases.value.filter(item => item !== id)
  } else {
    selectedCases.value = [...selectedCases.value, id]
  }
}

async function writeGroup(data: CaseGroup, update: boolean = false) {
	if (update) {
		const { error } = await supabase
			.from("case_groups")
			.update({
				name: data.name,
				title: data.title,
				created_at: data.created_at
			})
			.eq("id", data.id)
		if (error) {
			console.error(error)
			return
		}

		// Update group-case relationships
		if (selectedCases.value && data.id) {
			// Delete existing relationships
			await supabase.from("grouped_cases").delete().eq("group", data.id)

			// Insert new relationships
			const { error: groupError } = await supabase
				.from("grouped_cases")
				.insert(
					selectedCases.value.map((caseId) => ({
						case: caseId,
						group: data.id
					}))
				)
			if (groupError) {
				console.error(groupError)
			}
		}
	} else {
		const { data: newGroup, error } = await supabase
			.from("case_groups")
			.insert([
				{
					name: data.title.toLowerCase().replace(/\s/g, "-"),
					title: data.title,
					created_at: data.created_at
				}
			])
			.select()
			.single()

		if (error) {
			console.error(error)
			return
		}

		// Create group-case relationships
		if (selectedCases.value && newGroup.id) {
			const { error: groupError } = await supabase
				.from("grouped_cases")
				.insert(
					selectedCases.value.map((caseId) => ({
						case: caseId,
						group: newGroup.id
					}))
				)
			if (groupError) {
				console.error(groupError)
			}
		}
	}

	getAllCases()
	getCaseGroups()
	if (selectedGroup.value?.id === data.id) {
		selectedGroup.value = data
	}
}

function saveGroup(close: boolean = false, update: boolean = false) {
	if (editedGroup.value) {
		writeGroup(editedGroup.value, update)
		if (close) {
			linkModalOpen.value = false
		}
	}
}

async function removeFromGroup(caseId: string) {
	if (!selectedGroup.value?.id) return

	const { error } = await supabase
		.from("grouped_cases")
		.delete()
		.eq("case", caseId)
		.eq("group", selectedGroup.value.id)

	if (error) {
		console.error(error)
		return
	}

	await getAllCases()
	caseModalOpen.value = false
}

async function deleteGroup(id: string) {
	// Delete group-case relationships first
	const { error: relError } = await supabase
		.from("grouped_cases")
		.delete()
		.eq("group", id)

	if (relError) {
		console.error(relError)
		return
	}

	// Then delete the group
	const { error } = await supabase.from("case_groups").delete().eq("id", id)

	if (error) {
		console.error(error)
		return
	}

	linkModalOpen.value = false
	await getCaseGroups()
	filterGroup(0)
}

const editedGroup = ref<CaseGroup>()

const { metaSymbol } = useShortcuts()

defineShortcuts({
	meta_s: {
		usingInput: true,
		handler: () => saveCase(false, true)
	},
	meta_shift_s: {
		usingInput: true,
		handler: () => saveCase(true, true)
	},
	meta_n: {
		usingInput: true,
		handler: () => caseModal("")
	}
})
</script>

<template>
	<div class="flex flex-col lg:flex-row gap-3 w-full">
		<div class="w-full lg:w-min space-y-3 h-full">
			<div class="flex justify-between px-1">
				<div class="text-primary font-bold">Groups</div>
				<UButton
					color="primary"
					variant="link"
					icon="i-lucide-plus"
					@click="groupModal('')"
				/>
			</div>
			<UDivider />
			<UTabs
				v-model="selectedTabGroup"
				:items="groups"
				orientation="vertical"
				as="ul"
				class="w-full"
				:ui="{
					list: {
						background: 'dark:!bg-gray-900',
						marker: {
							background: '!bg-primary-500/10'
						}
					}
				}"
				@change="filterGroup"
			>
				<template #default="{ item, selected }">
					<li
						class="!w-full flex items-center !justify-start whitespace-nowrap"
						:class="[selected ? '!text-primary-500' : '']"
					>
						<UIcon name="i-lucide-folder" class="mr-2 h-4 w-4" />
						{{ item.label }}
					</li>
				</template>
			</UTabs>
		</div>
		<div class="flex flex-col gap-3 w-full">
			<div class="flex justify-between px-1">
				<div class="text-primary font-bold">Cases</div>
				<div class="flex">
					<UTooltip
						text="Create new Case"
						:shortcuts="[metaSymbol, 'N']"
					>
						<UButton
							color="primary"
							size="sm"
							variant="link"
							icon="i-lucide-plus"
							@click="caseModal('')"
						>
							Create Case
						</UButton>
					</UTooltip>
					<UDivider orientation="vertical" />
					<UTooltip
						text="Add existing case to group"
						:shortcuts="[metaSymbol, 'L']"
					>
						<UButton
							color="primary"
							size="sm"
							variant="link"
							icon="i-lucide-pen"
							:disabled="selectedGroup === undefined"
							@click="
								groupModal(
									selectedGroup?.id ? selectedGroup.id : ''
								)
							"
						>
							Edit Group
						</UButton>
					</UTooltip>
				</div>
			</div>
			<UDivider />
			<div
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
			>
				<div v-for="item in filteredCases" :key="item.id">
					<UCard
						:ui="{
							header: { padding: 'px-4 py-3 sm:p-4' },
							body: { padding: 'px-4 py-3 sm:p-4' },
							footer: { padding: 'px-4 py-3 sm:p-4' }
						}"
					>
						<template #header>
							<div class="font-bold text-primary-500">
								{{ item.title }}
							</div>
						</template>
						<template #default>
							<span
								v-if="item.text"
								class="line-clamp-1 text-ellipsis"
								>{{ item.text }}</span
							>
							<div v-else class="opacity-50">No description</div>
						</template>
						<template #footer>
							<div class="flex items-center justify-between">
								<div class="text-sm text-gray-500">
									{{
										dayjs(item.created_at).format(
											"D.MM.YYYY HH:mm"
										)
									}}
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
						</template>
					</UCard>
				</div>
			</div>
		</div>

		<UModal v-if="editedCase" v-model="caseModalOpen">
			<UCard
				:ui="{
					header: { padding: 'px-4 py-3 sm:p-4' },
					body: { padding: 'px-4 py-3 sm:p-4' },
					footer: { padding: 'px-4 py-3 sm:p-4' }
				}"
			>
				<template #header>
					<textarea
						v-model="editedCase.title"
						color="primary"
						variant="none"
						placeholder="Case Title"
						class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/50 placeholder:font-normal"
					/>
				</template>
				<template #default>
					<textarea
						v-model="editedCase.text"
						:autoresize="true"
						:rows="5"
						:maxrows="10"
						color="primary"
						variant="none"
						class="w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/50"
						placeholder="Description"
					/>
				</template>
				<template #footer>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 h-fit">
							<UTooltip
								v-if="editedCase.id"
								text="Delete"
								:shortcuts="[metaSymbol, 'Delete']"
							>
								<UButton
									color="red"
									size="sm"
									variant="link"
									icon="i-lucide-trash"
									@click="deleteCase(editedCase.id)"
								/>
							</UTooltip>

							<UTooltip
								v-if="
									editedCase.id &&
									selectedGroup &&
									selectedGroup.name !== 'All'
								"
								text="Remove from group"
								:shortcuts="[metaSymbol, 'Delete']"
							>
								<UButton
									color="red"
									size="sm"
									variant="link"
									icon="i-lucide-unlink"
									@click="removeFromGroup(editedCase.id)"
								/>
							</UTooltip>
						</div>

						<div class="flex items-center gap-2 h-fit">
							<UTooltip
								text="Save"
								:shortcuts="[metaSymbol, 'S']"
							>
								<UButton
									color="primary"
									size="sm"
									variant="link"
									icon="i-lucide-save"
									@click="
										saveCase(
											false,
											editedCase.id !== '' ? true : false
										)
									"
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
									@click="
										saveCase(
											true,
											editedCase.id !== '' ? true : false
										)
									"
								/>
							</UTooltip>
						</div>
					</div>
				</template>
			</UCard>
		</UModal>

		<UModal
			v-if="editedGroup"
			v-model="linkModalOpen"
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
					<textarea
						v-model="editedGroup.title"
						placeholder="Group Title"
						color="primary"
						variant="none"
						class="font-bold text-primary-500 w-full p-3 rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal"
					/>
				</template>
				<template #default>
					<!-- grid of all case titles -->
					<div
						class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
					>
						<div v-for="item in cases" :key="item.id">
							<UCard
								:ui="{
									header: { padding: 'px-4 py-3 sm:p-4' },
									body: { padding: 'px-4 py-3 sm:p-4' },
									footer: { padding: 'px-4 py-3 sm:p-4' },
									base: 'h-full outline outline-2 outline-transparent duration-100'
								}"
								:class="{
									'outline-primary-500/50':
										selectedCases.includes(item.id)
								}"
								@click="selectCase(item.id)"
							>
								{{ item.title }}
							</UCard>
						</div>
					</div>
				</template>
				<template #footer>
					<div class="flex items-center justify-between">
						<UTooltip
							v-if="editedGroup.id"
							text="Delete"
							:shortcuts="[metaSymbol, 'Delete']"
						>
							<UButton
								color="red"
								size="sm"
								variant="link"
								icon="i-lucide-trash"
								@click="deleteGroup(editedGroup.id)"
							/>
						</UTooltip>

						<div class="flex items-center gap-2 h-fit">
							<UTooltip
								text="Save"
								:shortcuts="[metaSymbol, 'S']"
							>
								<UButton
									color="primary"
									size="sm"
									variant="link"
									icon="i-lucide-save"
									@click="
										saveGroup(
											false,
											editedGroup.id !== '' ? true : false
										)
									"
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
									@click="
										saveGroup(
											true,
											editedGroup.id !== '' ? true : false
										)
									"
								/>
							</UTooltip>
						</div>
					</div>
				</template>
			</UCard>
		</UModal>

		<!-- <UModal>

		</UModal> -->
	</div>
</template>
