<script setup lang="ts">
useStablePageTitle({
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
