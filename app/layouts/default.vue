<script setup lang="ts">
const client = useSupabaseClient()
const user = useSupabaseUser()

const userIsLoggedIn = computed(() => user.value !== null)

const { data: userMetadata } = await useAsyncData("userMetadata", async () => {
	if (user.value?.id) {
		const { data, error } = await client.rpc("get_user_metadata", {
			user_ids: [user.value.id]
		})
		if (error) {
			console.error(error)
			return []
		}
		return data
	}
	return []
})

const userIsDev = computed(() => {
	return userMetadata.value?.[0]?.role === "dev"
})

const route = useRoute()
const router = useRouter()

// Make the path explicitly reactive to handle browser back/forward
const currentPath = ref(route.path)

// Update currentPath on all route changes (including browser back/forward)
router.afterEach((to) => {
	currentPath.value = to.path
})

const shouldShowNav = userIsDev
const shouldShowContent = computed(() => {
	const isDev = userIsDev.value
	const path = currentPath.value
	const isReportsPath = path.startsWith("/reports")
	const isConfirmPath = path.startsWith("/confirm")
	return isDev || isReportsPath || isConfirmPath
})

const text = computed(() => {
	if (!userIsLoggedIn.value) {
		return "Not logged in."
	} else if (!userIsDev.value) {
		return "Insufficient permissions."
	}
	return ""
})
</script>

<template>
	<main class="h-screen">
		<NavHeader />
		<div class="flex flex-col lg:flex-row">
			<NavSidebar v-if="shouldShowNav" />
			<div
				v-if="shouldShowContent"
				class="p-4 w-full h-full"
				:class="{ 'p-6': !shouldShowNav }"
			>
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
