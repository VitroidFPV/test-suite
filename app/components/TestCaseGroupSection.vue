<script setup lang="ts">
import { UNGROUPED_CASE_GROUP_LABEL } from "~/utils/groupCasesByCaseGroup"

defineProps<{
	title: string
}>()
</script>

<template>
	<div class="flex flex-col gap-y-3">
		<div class="font-bold text-default flex items-center gap-2">
			<UIcon
				:name="
					title === UNGROUPED_CASE_GROUP_LABEL
						? 'i-lucide-folder-open'
						: 'i-lucide-folder'
				"
				class="h-4 w-4"
			/>
			{{ title }}
		</div>
		<slot />
	</div>
</template>
