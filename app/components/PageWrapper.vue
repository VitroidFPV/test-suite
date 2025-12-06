<script setup lang="ts">
const props = defineProps<{
	breadcrumbs?: string
	title?: string
}>()
</script>

<template>
	<div class="flex flex-col gap-y-3">
		<div class="flex items-center justify-between gap-3 w-full">
			<div class="flex items-center gap-2">
				<slot name="breadcrumbs-leading" />
				<div v-if="breadcrumbs" class="flex gap-4 items-center">
					<div class="font-semibold text-primary-500">
						{{ breadcrumbs }}
					</div>
				</div>
				<slot name="breadcrumbs" />
			</div>
			<slot name="breadcrumbs-trailing" />
		</div>
		<div class="flex items-center justify-between gap-3 w-full">
			<div class="flex items-center gap-2">
				<slot name="title-leading" />
				<h1 v-if="title" class="text-5xl font-bold mb-4">
					{{ props.title }}
				</h1>
				<slot name="title" />
			</div>
			<slot name="title-trailing" />
		</div>
		<USeparator />
		<slot name="content" />
	</div>
</template>
