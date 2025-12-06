<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui"
const props = defineProps<{
	breadcrumbs?: BreadcrumbItem[]
	title?: string
}>()
</script>

<template>
	<div class="flex flex-col gap-y-3">
		<div class="flex items-center justify-between gap-3 w-full">
			<div class="flex items-center gap-2">
				<slot name="breadcrumbs-leading" />
				<UBreadcrumb v-if="breadcrumbs" :items="breadcrumbs" />
				<slot name="breadcrumbs" />
			</div>
			<slot name="breadcrumbs-trailing" />
		</div>
		<div class="flex items-center justify-between gap-3 w-full">
			<div class="flex items-center gap-2">
				<slot name="title-leading" />
				<h1 v-if="title" class="text-5xl font-bold">
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
