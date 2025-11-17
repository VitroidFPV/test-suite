<script setup lang="ts">
definePageMeta({
	layout: "blank"
})
const supabase = useSupabaseClient()

const signInWithOAuth = async () => {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: "github",
		options: {
			redirectTo: `${window.location.origin}/confirm`
		}
	})
	if (error) {
		console.error(error)
	}
}
</script>

<template>
	<div>
		<UButton @click="signInWithOAuth">Sign In with GitHub</UButton>
	</div>
</template>
