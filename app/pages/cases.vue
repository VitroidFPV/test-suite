<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import VueMarkdown from "vue-markdown-render"
import BaseCard from "~/components/cards/BaseCard.vue"

const { dateTimeProps } = useDateTimeFormat()

const toast = useToast()

const supabase = useSupabaseClient<Database>()

type CaseGroup = Tables<"test_case_groups">
type TestCase = Tables<"test_cases">

const {
	data: caseGroups,
	error: caseGroupsError,
	refresh: refreshCaseGroups
} = await useAsyncData(
	"caseGroups",
	async () => {
		const { data, error } = await supabase
			.from("test_case_groups")
			.select("*")
			.is("deleted_at", null)
		if (error) {
			throw createSupabaseError(error)
		}
		const rows = data ?? []
		return [...rows].sort((a, b) => a.name.localeCompare(b.name))
	},
	{ lazy: true }
)

const {
	data: cases,
	error: casesError,
	refresh: refreshCases
} = await useAsyncData(
	"cases",
	async () => {
		const { data, error } = await supabase
			.from("test_cases")
			.select("*")
			.is("deleted_at", null)
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

const {
	data: caseGroupLinks,
	error: caseGroupLinksError,
	refresh: refreshCaseGroupLinks
} = await useAsyncData(
	"caseGroupLinks",
	async () => {
		const { data, error } = await supabase
			.from("test_case_group_links")
			.select("*")
		if (error) {
			throw createSupabaseError(error)
		}
		return data
	},
	{ lazy: true }
)

// Consolidated page error - combines all errors when multiple are present
const pageError = computed(() => {
	const errors: Error[] = []
	if (caseGroupsError.value) errors.push(caseGroupsError.value)
	if (casesError.value) errors.push(casesError.value)
	if (caseGroupLinksError.value) errors.push(caseGroupLinksError.value)

	if (errors.length === 0) return null
	if (errors.length === 1) return errors[0]!
	return errors
})

async function retryAll() {
	await Promise.all([
		refreshCaseGroups(),
		refreshCases(),
		refreshCaseGroupLinks()
	])
}

const selectedGroup = ref<CaseGroup | undefined>()

// Filter cases by selected group
const filteredCases = computed(() => {
	if (!selectedGroup.value || selectedGroup.value.name === "all") {
		return cases.value
	}

	// Show loading state if either data source hasn't loaded yet
	if (!cases.value || !caseGroupLinks.value) {
		return undefined
	}

	// Handle "ungrouped" - cases that don't belong to any group
	if (selectedGroup.value.name === "ungrouped") {
		const allLinkedCaseIds = new Set(
			caseGroupLinks.value.map((link) => link.case)
		)
		return cases.value.filter((c) => !allLinkedCaseIds.has(c.id))
	}

	// Get case IDs that belong to the selected group
	const caseIdsInGroup = caseGroupLinks.value
		.filter((link) => link.group === selectedGroup.value?.id)
		.map((link) => link.case)

	return cases.value.filter((c) => caseIdsInGroup.includes(c.id))
})

const groups = computed(() => [
	{ label: "All", value: "all" },
	{ label: "Ungrouped", value: "ungrouped" },
	...(caseGroups.value?.map((item) => ({
		label: item.title,
		value: item.name
	})) ?? [])
])

const selectedTabGroup = ref<string>("all")

function filterGroup(value: string) {
	selectedTabGroup.value = value
	if (value === "all") {
		selectedGroup.value = undefined
	} else if (value === "ungrouped") {
		// Create a virtual group for ungrouped cases
		selectedGroup.value = {
			id: "",
			name: "ungrouped",
			title: "Ungrouped",
			created_at: "",
			deleted_at: null
		}
	} else {
		selectedGroup.value = caseGroups.value?.find(
			(group) => group.name === value
		)
	}
	editedGroup.value = selectedGroup.value
}
const caseModalOpen = ref(false)
const editedCase = ref<TestCase>()
const mdPreviewMode = ref(false)

watch(caseModalOpen, (isOpen) => {
	if (!isOpen) {
		mdPreviewMode.value = false
	}
})

function caseModal(id: string) {
	if (id) {
		const foundCase = cases.value?.find((item) => item.id === id)
		if (!foundCase) return

		editedCase.value = JSON.parse(JSON.stringify(foundCase))
	} else {
		editedCase.value = {
			case_id: 1,
			title: "",
			text: "",
			created_at: new Date().toISOString(),
			deleted_at: null,
			priority: null,
			id: ""
		}
	}
	caseModalOpen.value = true
}

async function writeCase(data: TestCase, update: boolean = false) {
	if (update) {
		const { error } = await supabase
			.from("test_cases")
			.update({
				title: data.title,
				text: data.text,
				case_id: data.case_id,
				created_at: data.created_at,
				priority: data.priority
			})
			.eq("id", data.id)
		if (error) {
			console.error(error)
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
			return
		}
	} else {
		const { data: newCase, error } = await supabase
			.from("test_cases")
			.insert([
				{
					title: data.title,
					text: data.text,
					created_at: data.created_at,
					priority: data.priority
				}
			])
			.select()
			.single()
		if (error) {
			console.error(error)
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
			return
		}

		// Add case to current group if one is selected
		if (selectedGroup.value && selectedGroup.value.id) {
			const { error: groupError } = await supabase
				.from("test_case_group_links")
				.insert([
					{
						case: newCase.id,
						group: selectedGroup.value.id
					}
				])
			if (groupError) {
				console.error(groupError)
				toast.add({
					title: "Error",
					description: groupError.message,
					color: "error"
				})
			}
			await refreshCaseGroupLinks()
		}
	}
	await refreshCases()
}

async function saveCase(close: boolean = false, update: boolean = false) {
	if (editedCase.value) {
		await writeCase(editedCase.value, update)
		if (close) {
			caseModalOpen.value = false
		}
	}
}

async function deleteCase(id: string) {
	const { error } = await supabase
		.from("test_cases")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id)
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
	}
	caseModalOpen.value = false
	await refreshCases()
}

const linkModalOpen = ref(false)
async function groupModal(id: string) {
	linkModalOpen.value = true

	if (id) {
		// Load existing group
		const group = caseGroups.value?.find((item) => item.id === id)
		if (!group) return

		editedGroup.value = JSON.parse(JSON.stringify(group))

		// Load associated cases
		const groupCaseIds =
			caseGroupLinks.value
				?.filter((link) => link.group === id)
				.map((link) => link.case) ?? []

		selectedCases.value = groupCaseIds
	} else {
		// New group
		editedGroup.value = {
			title: "",
			created_at: new Date().toISOString(),
			deleted_at: null,
			id: "",
			name: ""
		}
		selectedCases.value = []
	}
}

const selectedCases = ref<string[]>([])

function selectCase(id: string) {
	if (selectedCases.value.includes(id)) {
		selectedCases.value = selectedCases.value.filter((item) => item !== id)
	} else {
		selectedCases.value = [...selectedCases.value, id]
	}
}

async function writeGroup(data: CaseGroup, update: boolean = false) {
	if (update) {
		const { error } = await supabase
			.from("test_case_groups")
			.update({
				name: data.name,
				title: data.title,
				created_at: data.created_at
			})
			.eq("id", data.id)
		if (error) {
			console.error(error)
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
			return
		}

		// Update group-case relationships using diff approach (safer than delete-all + insert)
		if (data.id) {
			const currentLinks =
				caseGroupLinks.value
					?.filter((link) => link.group === data.id)
					.map((link) => link.case) ?? []

			const toAdd = selectedCases.value.filter(
				(caseId) => !currentLinks.includes(caseId)
			)
			const toRemove = currentLinks.filter(
				(caseId) => !selectedCases.value.includes(caseId)
			)

			// Insert new relationships first (if this fails, no data is lost)
			if (toAdd.length > 0) {
				const { error: insertError } = await supabase
					.from("test_case_group_links")
					.insert(toAdd.map((caseId) => ({ case: caseId, group: data.id })))
				if (insertError) {
					console.error(insertError)
					toast.add({
						title: "Error",
						description: insertError.message,
						color: "error"
					})
					return
				}
			}

			// Remove old relationships after (if this fails, we just have extra links)
			if (toRemove.length > 0) {
				const { error: deleteError } = await supabase
					.from("test_case_group_links")
					.delete()
					.eq("group", data.id)
					.in("case", toRemove)
				if (deleteError) {
					console.error(deleteError)
					toast.add({
						title: "Error",
						description: deleteError.message,
						color: "error"
					})
				}
			}
		}
	} else {
		const { data: newGroup, error } = await supabase
			.from("test_case_groups")
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
			toast.add({
				title: "Error",
				description: error.message,
				color: "error"
			})
			return
		}

		// Create group-case relationships
		if (selectedCases.value && newGroup.id) {
			const { error: groupError } = await supabase
				.from("test_case_group_links")
				.insert(
					selectedCases.value.map((caseId) => ({
						case: caseId,
						group: newGroup.id
					}))
				)
			if (groupError) {
				console.error(groupError)
				toast.add({
					title: "Error",
					description: groupError.message,
					color: "error"
				})
			}
		}
	}

	await Promise.all([refreshCaseGroups(), refreshCaseGroupLinks()])
	if (selectedGroup.value?.id === data.id) {
		selectedGroup.value = data
	}
}

async function saveGroup(close: boolean = false, update: boolean = false) {
	if (editedGroup.value) {
		await writeGroup(editedGroup.value, update)
		if (close) {
			linkModalOpen.value = false
		}
	}
}

async function removeFromGroup(caseId: string) {
	if (!selectedGroup.value?.id) return

	const { error } = await supabase
		.from("test_case_group_links")
		.delete()
		.eq("case", caseId)
		.eq("group", selectedGroup.value.id)

	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	await refreshCaseGroupLinks()
	caseModalOpen.value = false
}

async function deleteGroup(id: string) {
	// Soft delete the group. Link rows are preserved so undelete can restore associations.
	const { error } = await supabase
		.from("test_case_groups")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id)

	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
		return
	}

	linkModalOpen.value = false
	await Promise.all([refreshCaseGroups(), refreshCaseGroupLinks()])
	filterGroup("all")
}

const editedGroup = ref<CaseGroup>()

defineShortcuts({
	meta_s: {
		handler: () => saveCase(false, true)
	},
	meta_shift_s: {
		handler: () => saveCase(true, true)
	},
	shift_a: {
		handler: () => {
			if (caseGroups.value) {
				caseModal("")
			}
		}
	},
	shift_e: {
		handler: () => {
			if (
				selectedGroup.value?.name &&
				selectedGroup.value.name !== "ungrouped" &&
				caseGroups.value &&
				caseGroupLinks.value
			) {
				groupModal(selectedGroup.value?.id ?? "")
			}
		}
	}
})

useStablePageTitle({
	title: `Test Cases | Test Suite`
})
</script>

<template>
	<PageWrapper
		:breadcrumbs="[{ label: 'Dashboard', to: '/' }]"
		title="Test Cases"
		:error="pageError"
		@retry="retryAll"
	>
		<template #content>
			<div class="flex flex-col lg:flex-row gap-3 w-full">
				<div class="w-full lg:w-52 space-y-3 h-full">
					<div class="flex justify-between px-1">
						<div class="text-primary font-bold">Groups</div>
						<UButton
							color="primary"
							variant="link"
							icon="i-lucide-plus"
							:disabled="!caseGroupLinks"
							@click="groupModal('')"
						/>
					</div>
					<UTabs
						v-if="caseGroups !== undefined"
						v-model="selectedTabGroup"
						:items="groups"
						orientation="vertical"
						as="ul"
						:ui="{
							root: 'w-full min-w-full',
							list: 'dark:bg-neutral-900! lg:w-52 w-full min-w-full',
							indicator: 'bg-primary-500/10!',
							trigger: 'w-full justify-start'
						}"
						@update:model-value="(val) => filterGroup(String(val))"
					>
						<template #default="{ item }">
							<li
								class="flex items-center justify-start! whitespace-nowrap"
								:class="[
									item.value === selectedTabGroup ? 'text-primary-500!' : ''
								]"
							>
								<UIcon name="i-lucide-folder" class="mr-2 h-4 w-4" />
								{{ item.label }}
							</li>
						</template>
					</UTabs>
					<div v-else>
						<div
							class="w-52 flex flex-col dark:bg-neutral-900! h-fit rounded-lg p-1"
						>
							<div
								v-for="i in 3"
								:key="i"
								class="w-full! flex items-center justify-start! whitespace-nowrap h-8 px-3"
							>
								<UIcon
									name="i-lucide-folder"
									class="mr-2 h-4 w-4 animate-pulse dark:text-neutral-400"
								/>
								<USkeleton class="h-4 w-full" />
							</div>
						</div>
					</div>
				</div>
				<div class="flex flex-col gap-3 w-full">
					<div class="flex justify-between px-1">
						<div class="text-primary font-bold">Cases</div>
						<div class="flex items-center gap-2">
							<UTooltip text="Create new Case" :kbds="['shift', 'A']">
								<UButton
									color="primary"
									size="xs"
									variant="soft"
									icon="i-lucide-plus"
									:disabled="!caseGroups"
									@click="caseModal('')"
								>
									New Case
								</UButton>
							</UTooltip>
							<UTooltip text="Edit Group" :kbds="['shift', 'E']">
								<UButton
									color="neutral"
									size="xs"
									variant="soft"
									icon="i-lucide-pen"
									:disabled="
										!selectedGroup ||
										!caseGroups ||
										!caseGroupLinks ||
										selectedGroup.name === 'ungrouped'
									"
									@click="groupModal(selectedGroup?.id ? selectedGroup.id : '')"
								>
									Edit Group
								</UButton>
							</UTooltip>
						</div>
					</div>
					<div
						v-if="filteredCases && filteredCases.length > 0"
						class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 w-full"
					>
						<div v-for="item in filteredCases" :key="item.id">
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
								<template #footer>
									<div class="flex items-center justify-between">
										<NuxtTime
											:datetime="item.created_at"
											class="text-sm text-neutral-500"
											v-bind="dateTimeProps"
										/>
										<div class="flex items-center gap-2">
											<UButton
												color="primary"
												size="xs"
												variant="link"
												icon="i-lucide-pencil"
												@click="caseModal(item.id)"
											/>
										</div>
									</div>
								</template>
							</BaseCard>
						</div>
					</div>
					<div
						v-else-if="!filteredCases"
						class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
					>
						<div v-for="i in 12" :key="i">
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
								<template #footer>
									<div class="flex items-center justify-between">
										<div class="text-sm text-neutral-500">
											<USkeleton class="w-1/2 h-6" />
										</div>
										<div class="flex items-center gap-2">
											<USkeleton class="w-1/2 h-6" />
										</div>
									</div>
								</template>
							</BaseCard>
						</div>
					</div>
					<div v-else class="text-neutral-500">No cases found</div>
				</div>
				<UModal
					v-if="editedCase"
					v-model:open="caseModalOpen"
					:title="editedCase.id ? 'Edit Case' : 'Create Case'"
					:description="
						editedCase.id
							? 'Edit the case title and description'
							: 'Create a new test case with a title and description'
					"
					:ui="{
						content: 'max-w-3xl',
						title: 'text-primary'
					}"
				>
					<template #body>
						<div class="flex flex-col gap-3">
							<textarea
								v-model="editedCase.title"
								placeholder="Case Title"
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
									v-model="editedCase.text"
									color="primary"
									placeholder="Case Description (supports Markdown)"
									variant="soft"
									:rows="7"
									class="min-h-40"
									:ui="{ base: 'text-base' }"
								/>
								<div
									v-if="mdPreviewMode"
									class="md min-h-40 max-h-80 overflow-y-auto p-2 rounded-lg"
								>
									<VueMarkdown
										v-if="editedCase.text"
										:source="editedCase.text"
									/>
									<span v-else class="text-neutral-500">No description</span>
								</div>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex items-center justify-between w-full">
							<div class="flex items-center gap-2 h-fit">
								<UTooltip
									v-if="editedCase.id"
									text="Delete"
									:shortcuts="['meta', 'Delete']"
								>
									<UButton
										color="error"
										size="xs"
										variant="link"
										icon="i-lucide-trash"
										loading-auto
										@click="deleteCase(editedCase.id)"
									/>
								</UTooltip>
								<UTooltip
									v-if="editedCase.id && selectedGroup"
									text="Remove from group"
									:shortcuts="['meta', 'Delete']"
								>
									<UButton
										color="error"
										size="xs"
										variant="link"
										icon="i-lucide-unlink"
										loading-auto
										@click="removeFromGroup(editedCase.id)"
									/>
								</UTooltip>
							</div>
							<div class="flex items-center gap-2 h-fit">
								<UTooltip
									:text="editedCase.id ? 'Save & Close' : 'Create Case'"
									:shortcuts="['meta', 'Shift', 'S']"
								>
									<UButton
										color="primary"
										size="sm"
										variant="soft"
										:icon="
											editedCase.id ? 'i-lucide-save-all' : 'i-lucide-plus'
										"
										:disabled="!editedCase.title?.trim()"
										loading-auto
										@click="saveCase(true, editedCase.id !== '' ? true : false)"
									>
										{{ editedCase.id ? "Apply" : "Create Case" }}
									</UButton>
								</UTooltip>
							</div>
						</div>
					</template>
				</UModal>
				<UModal
					v-if="editedGroup"
					v-model:open="linkModalOpen"
					title="Edit Group"
					description="Edit the group title and add/remove cases from it"
					:ui="{
						content: 'max-w-full lg:max-w-6xl',
						title: 'text-primary'
					}"
				>
					<template #body>
						<div class="flex flex-col gap-3">
							<UInput
								v-model="editedGroup.title"
								placeholder="Group Title"
								color="primary"
								class="font-bold text-primary-500 w-full rounded-lg resize-none outline-none focus-visible:outline-primary-500/5 placeholder:font-normal"
							/>
							<div
								class="grid 2xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3"
							>
								<div v-for="item in cases ?? []" :key="item.id">
									<UCard
										:ui="{
											header: 'px-4 py-3 sm:p-4',
											body: 'px-4 py-3 sm:p-4',
											footer: 'px-4 py-3 sm:p-4',
											root: 'h-full outline-2 outline-transparent duration-100'
										}"
										:class="{
											'outline-primary-500/50': selectedCases.includes(item.id)
										}"
										@click="selectCase(item.id)"
									>
										{{ item.title }}
									</UCard>
								</div>
							</div>
						</div>
					</template>
					<template #footer>
						<div class="flex items-center justify-between w-full">
							<UTooltip
								v-if="editedGroup.id"
								text="Delete"
								:shortcuts="['meta', 'Delete']"
							>
								<UButton
									color="error"
									size="xs"
									variant="link"
									icon="i-lucide-trash"
									loading-auto
									@click="deleteGroup(editedGroup.id)"
								/>
							</UTooltip>
							<div class="flex items-center gap-2 h-fit">
								<UTooltip text="Save" :shortcuts="['meta', 'S']">
									<UButton
										color="primary"
										size="xs"
										variant="link"
										icon="i-lucide-save"
										loading-auto
										@click="
											saveGroup(false, editedGroup.id !== '' ? true : false)
										"
									/>
								</UTooltip>
								<UTooltip
									text="Save & Close"
									:shortcuts="['meta', 'Shift', 'S']"
								>
									<UButton
										color="primary"
										size="xs"
										variant="link"
										icon="i-lucide-save-all"
										loading-auto
										@click="
											saveGroup(true, editedGroup.id !== '' ? true : false)
										"
									/>
								</UTooltip>
							</div>
						</div>
					</template>
				</UModal>
			</div>
		</template>
	</PageWrapper>
</template>
