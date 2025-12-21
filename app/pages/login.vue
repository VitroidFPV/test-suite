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
	<div class="flex flex-col items-center justify-center gap-4">
		<UButton icon="i-lucide-github" @click="signInWithOAuth"
			>Sign In with GitHub</UButton
		>
		<p class="text-sm text-neutral-500 max-w-[80ch] text-center">
			After signing in, accounts need to be manually verified by an
			administrator before they can access the app.<br />
			Unexpected/unknown account sign-ins will not be approved.
		</p>
	</div>
</template>
