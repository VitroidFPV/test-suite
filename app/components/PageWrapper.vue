<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui"
const props = defineProps<{
	breadcrumbs?: BreadcrumbItem[]
	title?: string | null
	loading?: boolean
}>()
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex items-center justify-between gap-3 w-full">
			<div class="flex items-center gap-2">
				<slot name="breadcrumbs-leading" />
				<UBreadcrumb :items="breadcrumbs" />
				<slot name="breadcrumbs" />
			</div>
			<slot name="breadcrumbs-trailing" />
		</div>
		<div
			class="flex items-start lg:items-center justify-between gap-3 w-full flex-col lg:flex-row"
		>
			<div class="flex items-center gap-2">
				<slot name="title-leading" />
				<h1 v-if="title && !loading" class="lg:text-5xl text-3xl font-bold">
					{{ props.title }}
				</h1>
				<USkeleton v-if="loading" class="lg:w-lg w-xs h-9 lg:h-12" />
				<slot name="title" />
			</div>
			<slot name="title-trailing" />
		</div>
		<slot name="description" />
		<USeparator />
		<slot name="content" />
	</div>
</template>
