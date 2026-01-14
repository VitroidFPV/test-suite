// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },
	modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/supabase", "convex-nuxt"],
	compatibilityDate: "2024-11-30",
	supabase: {
		redirectOptions: {
			login: "/login",
			callback: "/confirm",
			exclude: ["/reports/**"]
		}
	},
	app: {
		head: {
			link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }]
		}
	},
	convex: {
		url: process.env.CONVEX_URL
	},
	css: ["~/assets/css/main.css"]
})
