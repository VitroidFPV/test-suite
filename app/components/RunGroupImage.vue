<script setup lang="ts">
const props = defineProps<{
	src: string | null
	alt: string
	size?: "sm" | "lg"
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
		:class="size === 'lg' ? 'h-16 w-16' : 'h-10 w-10'"
		@error="failed = true"
	/>
</template>
