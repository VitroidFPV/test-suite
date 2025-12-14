<script setup lang="ts">
definePageMeta({
	layout: "blank"
})

const supabase = useSupabaseClient()
const toast = useToast()

const signInWithOAuth = async () => {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: "github",
		options: {
			redirectTo: `${window.location.origin}/confirm`
		}
	})
	if (error) {
		console.error(error)
		toast.add({
			title: "Error",
			description: error.message,
			color: "error"
		})
	}
}
</script>

<template>
	<div>
		<UButton @click="signInWithOAuth">Sign In with GitHub</UButton>
	</div>
</template>
