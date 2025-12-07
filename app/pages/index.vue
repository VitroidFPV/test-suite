<script setup lang="ts">
useHead({
	title: `Home | Test Suite`
})
</script>

<template>
	<PageWrapper :breadcrumbs="[{ label: 'Dashboard', to: '/' }]" title="Home">
		<template #content>
			<div>Home Content</div>
		</template>
	</PageWrapper>
</template>
