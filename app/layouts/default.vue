<script setup lang="ts">
const client = useSupabaseClient()
const user = useSupabaseUser()

const userIsLoggedIn = user.value !== null

const { data: userMetadata } = await useAsyncData("userMetadata", async () => {
	const { data, error } = await client.rpc("get_user_metadata", {
		user_ids: [user.value?.id]
	})
	if (error) {
		console.error(error)
		return []
	}
	return data
})

const userIsDev = computed(() => {
	return userMetadata.value?.[0]?.role === "dev"
})

const route = useRoute()

const shouldShowNav = userIsDev
const shouldShowContent = computed(() => {
	return (
		userIsDev.value ||
		route.path.startsWith("/reports") ||
		route.path.startsWith("/confirm")
	)
})
console.log(userIsDev.value, route.path)
let text = ""
if (!userIsLoggedIn) {
	text = "Not logged in."
} else if (!userIsDev.value) {
	text = "Insufficient permissions."
}
</script>

<template>
	<main class="h-screen">
		<NavHeader />
		<div class="flex flex-col lg:flex-row">
			<NavSidebar v-if="shouldShowNav" />
			<div v-if="shouldShowContent" class="p-4 w-full h-full">
				<slot />
			</div>
		</div>
		<div v-if="!shouldShowContent">
			<div
				class="h-full-nav w-full flex flex-col gap-4 items-center justify-center"
			>
				<p>You don't have permission to view this page.</p>
				<p>{{ text }}</p>
			</div>
		</div>
	</main>
</template>
