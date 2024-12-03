<script setup lang="ts">
	const supabase = useSupabaseClient()
	const user = useSupabaseUser()

	const userIsLoggedIn = user.value !== null
	
	const { data, error } = await supabase.from("user_metadata").select("role").single()
	if (error) {
		console.error(error)
	}

	const userIsDev = data?.role === "dev"

	let text = "";
	if (!userIsLoggedIn) {
		text = "Not logged in."
	} else if (!userIsDev) {
		text = "Insufficient permissions."
	}
</script>

<template>
	<main class="h-screen">
		<NavHeader />
		<div v-if="userIsDev" class="flex flex-col lg:flex-row">
			<NavSidebar />
			<div class="p-3 w-full h-full">
				<slot />
			</div>
		</div>
		<div v-else>
			<div class="h-full-nav w-full flex flex-col gap-4 items-center justify-center">
				<p>You don't have permission to view this page.</p>
				<p>{{ text }}</p>
			</div>
		</div>
	</main>
</template>
