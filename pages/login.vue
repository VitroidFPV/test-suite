<script setup lang="ts">
definePageMeta({
	layout: "blank"
})
const supabase = useSupabaseClient()

async function signIn() {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: "github"
	})
	if (error) {
		console.error(error)
	}
}
</script>

<template>
	<div>
		<UButton @click="signIn">Sign In with GitHub</UButton>
	</div>
</template>
