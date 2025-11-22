export default defineAppConfig({
	ui: {
		button: {
			slots: {
				base: "font-semibold cursor-pointer"
			}
		},
		colors: {
			primary: "primary",
			neutral: "neutral",
			strategy: "override",
			button: {
				color: {
					primary: {
						solid: "bg-primary-500 hover:bg-primary-400 text-black"
					}
				}
			}
		}
	}
})
