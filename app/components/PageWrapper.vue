<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui"

const props = defineProps<{
	breadcrumbs?: BreadcrumbItem[]
	title?: string | null
	loading?: boolean
	error?: Error | null
	backLink?: string
}>()

const emit = defineEmits<{
	retry: []
}>()

const hasError = computed(() => !!props.error)

// Check if error is a "not found" type error (PGRST116)
const isNotFound = computed(() => {
	if (!props.error) return false
	const message = props.error.message?.toLowerCase() || ""
	const err = props.error as unknown as Record<string, unknown>
	const code = String(err.code || "").toLowerCase()

	return (
		code === "pgrst116" ||
		message.includes("not found") ||
		message.includes("pgrst116") ||
		message.includes("no rows") ||
		message.includes("(or no) rows returned") ||
		message.includes("0 rows") ||
		message.includes("cannot coerce") ||
		message.includes("single json object")
	)
})

const errorMessage = computed(() => {
	return props.error?.message || "Failed to load data"
})

// Extract all error details for display
const errorDetails = computed(() => {
	if (!props.error) return null

	const err = props.error as unknown as Record<string, unknown>
	const details: { label: string; value: string }[] = []

	// Common error properties from Supabase/PostgREST
	if (err.code) details.push({ label: "Code", value: String(err.code) })
	const statusValue = err.statusCode ?? err.status
	if (statusValue) details.push({ label: "Status", value: String(statusValue) })
	if (err.hint) details.push({ label: "Hint", value: String(err.hint) })
	if (err.details)
		details.push({ label: "Details", value: String(err.details) })
	if (err.name && err.name !== "Error")
		details.push({ label: "Type", value: String(err.name) })

	return details.length > 0 ? details : null
})
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
				<h1
					v-if="title && !loading && !hasError"
					class="lg:text-5xl text-3xl font-bold"
				>
					{{ props.title }}
				</h1>
				<h1
					v-else-if="hasError && isNotFound"
					class="lg:text-5xl text-3xl font-bold text-error"
				>
					Not Found
				</h1>
				<h1
					v-else-if="hasError"
					class="lg:text-5xl text-3xl font-bold text-error"
				>
					Error
				</h1>
				<USkeleton
					v-if="loading && !hasError"
					class="lg:w-lg w-xs h-9 lg:h-12"
				/>
				<slot name="title" />
			</div>
			<slot v-if="!hasError" name="title-trailing" />
		</div>
		<slot v-if="!hasError" name="description" />
		<USeparator />

		<!-- Error State -->
		<div
			v-if="hasError"
			class="flex flex-col items-center justify-center py-12 gap-6"
		>
			<div class="flex flex-col items-center gap-4 max-w-md text-center">
				<div
					class="w-16 h-16 rounded-full flex items-center justify-center"
					:class="isNotFound ? 'bg-warning/10' : 'bg-error/10'"
				>
					<UIcon
						:name="
							isNotFound ? 'i-lucide-file-question' : 'i-lucide-alert-circle'
						"
						class="w-8 h-8"
						:class="isNotFound ? 'text-warning' : 'text-error'"
					/>
				</div>
				<div class="flex flex-col gap-3">
					<p class="text-lg font-medium text-neutral-200">
						{{ errorMessage }}
					</p>
					<div
						v-if="errorDetails && errorDetails.length > 0"
						class="flex flex-col gap-1 text-sm text-neutral-500"
					>
						<div
							v-for="detail in errorDetails"
							:key="detail.label"
							class="flex justify-center gap-2"
						>
							<span class="font-medium text-neutral-400"
								>{{ detail.label }}:</span
							>
							<span class="font-mono">{{ detail.value }}</span>
						</div>
					</div>
				</div>
				<div class="flex gap-3 mt-2">
					<UButton
						v-if="backLink"
						:to="backLink"
						color="neutral"
						variant="soft"
						icon="i-lucide-arrow-left"
					>
						Go Back
					</UButton>
					<UButton
						v-if="!isNotFound"
						color="primary"
						variant="soft"
						icon="i-lucide-refresh-cw"
						@click="emit('retry')"
					>
						Try Again
					</UButton>
				</div>
			</div>
		</div>

		<!-- Normal Content -->
		<slot v-else name="content" />
	</div>
</template>
