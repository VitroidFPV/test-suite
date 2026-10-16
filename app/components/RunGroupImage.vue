<script setup lang="ts">
import { optionalExternalUrl } from "~/utils/optionalExternalUrl"

const props = defineProps<{
	src: string | null
	alt: string
	size?: "xs" | "avatar" | "sm" | "lg"
	fallback?: boolean
}>()
const failed = ref(false)
const safeSrc = computed(() => optionalExternalUrl(props.src))
watch(
	() => props.src,
	() => {
		failed.value = false
	}
)
</script>

<template>
	<img
		v-if="safeSrc && !failed"
		:src="safeSrc"
		:alt="alt"
		loading="lazy"
		class="shrink-0 rounded-lg border border-neutral-700 bg-neutral-800 object-contain p-1"
		:class="
			size === 'lg'
				? 'h-16 w-16'
				: size === 'avatar'
					? 'h-7 w-7 p-0.5'
					: size === 'xs'
						? 'h-6 w-6 p-0.5'
						: 'h-10 w-10'
		"
		@error="failed = true"
	/>
	<UIcon
		v-else-if="fallback"
		name="i-lucide-factory"
		:aria-label="alt"
		class="shrink-0 text-neutral-400"
		:class="
			size === 'lg'
				? 'h-16 w-16'
				: size === 'avatar'
					? 'h-7 w-7'
					: size === 'xs'
						? 'h-6 w-6'
						: 'h-10 w-10'
		"
	/>
</template>
