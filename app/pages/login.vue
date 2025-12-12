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

useHead({
	title: "Sign In | Test Suite"
})
</script>

<template>
	<div class="flex flex-col items-center justify-center gap-4">
		<UButton icon="i-lucide-github" @click="signInWithOAuth"
			>Sign In with GitHub</UButton
		>
		<p class="text-sm text-neutral-500 max-w-[60ch] text-center">
			After signing in, accounts still need to be manually verified by an
			administrator. Unexpected account sign-ins will not be approved.
		</p>
	</div>
</template>
