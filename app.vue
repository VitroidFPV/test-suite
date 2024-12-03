<template>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>

<style>
.dark {
	--color-primary-DEFAULT: var(--color-primary-500);
}

.dark\:text-primary-400:is(.dark *) {
	color: rgb(var(--color-primary-500) / var(--tw-text-opacity, 1));
}
</style>
