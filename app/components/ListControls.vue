<script setup lang="ts">
import type { ListControlOption, ListSortOrder } from "~/utils/listGrouping"

defineProps<{
	groupOptions: ListControlOption[]
	sortOptions: ListControlOption[]
}>()

const groupBy = defineModel<ListControlOption>("groupBy", { required: true })
const groupSortOrder = defineModel<ListSortOrder>("groupSortOrder", {
	required: true
})
const sortBy = defineModel<ListControlOption>("sortBy", { required: true })
const sortOrder = defineModel<ListSortOrder>("sortOrder", { required: true })

const groupSortLabel = computed(() =>
	groupSortOrder.value === "asc"
		? "Sort groups descending"
		: "Sort groups ascending"
)
const itemSortLabel = computed(() =>
	sortOrder.value === "asc" ? "Sort items descending" : "Sort items ascending"
)
</script>

<template>
	<div class="flex flex-wrap items-center gap-2">
		<div class="text-sm text-neutral-500">Group by</div>
		<USelectMenu
			v-model="groupBy"
			:items="groupOptions"
			:ui="{ content: 'min-w-fit' }"
			class="w-36"
		/>
		<UTooltip :text="groupSortLabel">
			<UButton
				color="neutral"
				variant="ghost"
				size="sm"
				:disabled="groupBy.value === 'none'"
				:icon="listSortOrderIcon(groupSortOrder)"
				:aria-label="groupSortLabel"
				@click="groupSortOrder = groupSortOrder === 'asc' ? 'desc' : 'asc'"
			/>
		</UTooltip>
		<div class="text-sm text-neutral-500">Sort by</div>
		<USelectMenu
			v-model="sortBy"
			:items="sortOptions"
			:ui="{ content: 'min-w-fit' }"
			class="w-36"
		/>
		<UTooltip :text="itemSortLabel">
			<UButton
				color="neutral"
				variant="ghost"
				size="sm"
				:icon="listSortOrderIcon(sortOrder)"
				:aria-label="itemSortLabel"
				@click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
			/>
		</UTooltip>
	</div>
</template>
