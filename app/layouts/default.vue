<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui"

const client = useSupabaseClient()
const user = useSupabaseUser()

const userIsLoggedIn = computed(() => user.value !== null)

// Track whether initial auth check has completed
const authInitialized = ref(false)
onMounted(async () => {
	await client.auth.getSession()
	authInitialized.value = true
})

const { data: userMetadata, pending: userMetadataPending } = useAsyncData(
	"userMetadata",
	async () => {
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
	},
	{ watch: [user], server: false, default: () => [] }
)

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

const shouldShowNav = computed(() => userIsDev.value)

// Show loading while auth is initializing or metadata is being fetched
const isLoading = computed(() => {
	if (!authInitialized.value) return true
	if (userIsLoggedIn.value && userMetadataPending.value) return true
	return false
})

const shouldShowContent = computed(() => {
	const isDev = userIsDev.value
	const path = currentPath.value
	const isReportsPath = path.startsWith("/reports")
	const isConfirmPath = path.startsWith("/confirm")
	// Don't show the "no permission" screen until we've finished loading
	if (isLoading.value) return true
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

const links = [
	[
		{
			label: "Home",
			icon: "i-lucide-home",
			to: "/"
		}
	],
	[
		{
			label: "Test Cases",
			icon: "i-lucide-book-text",
			to: "/cases"
		},
		{
			label: "Test Plans",
			icon: "i-lucide-book-check",
			to: "/plans"
		},
		{
			label: "Run Groups",
			icon: "i-lucide-library-big",
			to: "/run-groups"
		},
		{
			label: "Test Runs",
			icon: "i-lucide-book-up",
			to: "/runs"
		},
		{
			label: "Test Reports",
			icon: "i-lucide-clipboard-list",
			to: "/reports"
		}
	]
] as const satisfies NavigationMenuItem[][] | NavigationMenuItem[]
</script>

<template>
	<main class="h-screen">
		<UDashboardGroup v-if="shouldShowContent" class="flex-col">
			<NavHeader :should-show-nav="shouldShowNav" />
			<!-- Loading state while initializing auth or fetching user metadata -->
			<div v-if="isLoading" class="flex-1 flex items-center justify-center">
				<UIcon
					name="i-lucide-loader-circle"
					class="w-8 h-8 animate-spin text-primary-500"
				/>
			</div>
			<div v-else class="flex flex-1 min-h-0">
				<UDashboardSidebar
					v-if="shouldShowNav"
					:ui="{ root: 'w-fit border-none min-h-full h-full items-center' }"
					collapsible
					:toggle-side="'right'"
				>
					<!-- <NavSidebar v-if="shouldShowNav" /> -->
					<template #default="{ collapsed }">
						<UNavigationMenu
							:items="links"
							orientation="vertical"
							:collapsed="collapsed"
							tooltip
							:ui="{
								list: 'flex gap-1 flex-col h-fit',
								link: 'p-3 flex items-center justify-start rounded-lg font-semibold text-base whitespace-nowrap data-active:bg-primary-500/10 before:bg-transparent',
								linkLeadingIcon: 'h-6 w-6'
							}"
						/>
					</template>
				</UDashboardSidebar>
				<div
					class="p-2 lg:p-4 w-full h-full overflow-y-auto"
					:class="{ 'p-6': !shouldShowNav }"
				>
					<slot />
				</div>
			</div>
		</UDashboardGroup>
		<div v-else>
			<div
				class="h-screen w-full flex flex-col gap-4 items-center justify-center"
			>
				<p>You don't have permission to view this page.</p>
				<p>{{ text }}</p>
			</div>
		</div>
	</main>
</template>
