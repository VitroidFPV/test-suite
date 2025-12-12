<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui"

const client = useSupabaseClient()
const user = useSupabaseUser()

const userIsLoggedIn = computed(() => user.value !== null)

const { data: userMetadata } = await useAsyncData(
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
	{ watch: [user], server: false }
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
			<div class="flex flex-1 min-h-0">
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
								link: 'px-4 py-3 flex items-center justify-start rounded-lg font-semibold whitespace-nowrap data-active:bg-primary-500/10 before:bg-transparent',
								linkLeadingIcon: 'h-6 w-6'
							}"
						/>
					</template>
				</UDashboardSidebar>
				<div
					class="p-4 w-full h-full overflow-y-auto"
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
