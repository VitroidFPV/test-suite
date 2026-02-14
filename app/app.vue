<script setup lang="ts">
const stablePageTitle = useState<string | undefined>("stable-page-title")

useHead({
	title: computed(() => stablePageTitle.value || "Test Suite")
})
</script>

<template>
	<UApp
		:tooltip="{
			delayDuration: 300
		}"
	>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>
