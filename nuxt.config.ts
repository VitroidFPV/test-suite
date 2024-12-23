// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },
	modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/supabase"],
	compatibilityDate: "2024-11-30",
	supabase: {
		redirectOptions: {
			login: "/login",
			callback: "/"
		}
	},
	app: {
		head: {
			link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }]
		}
	}
})
