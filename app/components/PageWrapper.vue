<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui"

const props = defineProps<{
	breadcrumbs?: BreadcrumbItem[]
	title?: string | null
	loading?: boolean
	error?: Error | Error[] | null
	backLink?: string
}>()

const emit = defineEmits<{
	retry: []
}>()

const hasError = computed(() => !!props.error)

// Normalize error to array for consistent handling
const errors = computed(() => {
	if (!props.error) return []
	return Array.isArray(props.error) ? props.error : [props.error]
})

// Check if error is a "not found" type error (PGRST116)
const isNotFound = computed(() => {
	if (errors.value.length === 0) return false

	// If any error is a "not found" error, treat as not found
	return errors.value.some((err) => {
		const message = err.message?.toLowerCase() || ""
		const errObj = err as unknown as Record<string, unknown>
		const code = String(errObj.code || "").toLowerCase()

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
})

// Extract error details for a single error
function getErrorDetails(err: Error) {
	const errObj = err as unknown as Record<string, unknown>
	const details: { label: string; value: string }[] = []

	if (errObj.code) {
		details.push({ label: "Code", value: String(errObj.code) })
	}
	const statusValue = errObj.statusCode ?? errObj.status
	if (statusValue) {
		details.push({ label: "Status", value: String(statusValue) })
	}
	if (errObj.hint) {
		details.push({ label: "Hint", value: String(errObj.hint) })
	}
	if (errObj.details) {
		details.push({ label: "Details", value: String(errObj.details) })
	}
	if (errObj.name && errObj.name !== "Error") {
		details.push({ label: "Type", value: String(errObj.name) })
	}

	return details
}
</script>

<template>
	<div class="flex flex-col gap-y-6 h-full">
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
		<div class="flex items-center gap-3 w-full">
			<USeparator class="flex-1 min-w-0" />
			<slot v-if="!hasError" name="separator-trailing" />
		</div>

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
				<div class="flex flex-col gap-4 w-full">
					<div
						v-for="(err, index) in errors"
						:key="index"
						class="flex flex-col gap-2"
					>
						<p
							v-if="errors.length > 1"
							class="text-sm font-medium text-neutral-400"
						>
							Error {{ index + 1 }}
						</p>
						<p class="text-lg font-medium text-neutral-200">
							{{ err.message || "Failed to load data" }}
						</p>
						<div
							v-if="getErrorDetails(err).length > 0"
							class="flex flex-col gap-1 text-sm text-neutral-500"
						>
							<div
								v-for="detail in getErrorDetails(err)"
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
