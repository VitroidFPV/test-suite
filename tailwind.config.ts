import type { Config } from "tailwindcss"

export default <Partial<Config>>{
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#fffeea",
					100: "#fffac5",
					200: "#fff685",
					300: "#ffea46",
					400: "#ffdb1b",
					500: "#ffbb00",
					600: "#e29000",
					700: "#bb6502",
					800: "#984e08",
					900: "#7c400b",
					950: "#482100"
				}
			}
		}
	}
}
