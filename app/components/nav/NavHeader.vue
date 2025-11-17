<script setup lang="ts">
const supabase = useSupabaseClient()
// get user info from supabase
const user = useSupabaseUser()

const avatar = computed(() => {
	if (user.value && user.value.user_metadata) {
		return user.value.user_metadata.avatar_url
	}
	return ""
})

const name = computed(() => {
	if (user.value && user.value.user_metadata) {
		return user.value.user_metadata.preferred_username
	}
	return ""
})

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

function signOut() {
	supabase.auth.signOut()
	window.location.href = "/login"
}
</script>

<template>
	<header class="sticky top-0 w-full z-50">
		<nav
			class="flex bg-black/0 backdrop-blur-sm h-16 items-center px-6 w-full justify-between"
		>
			<div class="text-2xl font-bold text-primary-500 flex items-center gap-3">
				<div class="h-8 w-8 mt-1">
					<svg
						viewBox="0 0 128 128"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M64 69.25C66.8995 69.25 69.25 66.8995 69.25 64C69.25 61.1005 66.8995 58.75 64 58.75C61.1005 58.75 58.75 61.1005 58.75 64C58.75 66.8995 61.1005 69.25 64 69.25Z"
							stroke="#FFBB00"
							stroke-width="10.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M107.05 107.05C117.76 96.3925 107.155 68.41 83.425 44.575C59.59 20.845 31.6075 10.24 20.95 20.95C10.24 31.6075 20.845 59.59 44.575 83.425C68.41 107.155 96.3925 117.76 107.05 107.05Z"
							stroke="#FFBB00"
							stroke-width="10.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M83.425 83.425C107.155 59.59 117.76 31.6075 107.05 20.95C96.3925 10.24 68.41 20.845 44.575 44.575C20.845 68.41 10.24 96.3925 20.95 107.05C31.6075 117.76 59.59 107.155 83.425 83.425Z"
							stroke="#FFBB00"
							stroke-width="10.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>

				<div>Test Suite</div>
			</div>
			<div class="flex items-center gap-3">
				<!-- <div v-if="name != ''" class="">{{ name }}</div> -->
				<UPopover v-if="user">
					<UAvatar
						v-if="avatar != ''"
						:src="avatar"
						class="outline-1 outline-neutral-700 justify-self-end"
						size="md"
					/>
					<template #content>
						<div>
							<div class="w-48 flex flex-col gap-2 p-4">
								<div class="font-bold">{{ name }}</div>
								<USeparator />
								<UButton color="neutral" variant="subtle" @click="signOut"
									>Sign Out</UButton
								>
							</div>
						</div>
					</template>
				</UPopover>
				<UButton
					v-else
					color="neutral"
					variant="subtle"
					icon="i-lucide-github"
					@click="signInWithOAuth"
					>Sign In</UButton
				>
			</div>
		</nav>
	</header>
</template>
