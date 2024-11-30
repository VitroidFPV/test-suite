// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs"
import eslintPluginPrettier from "eslint-plugin-prettier"

export default withNuxt(
	// Your custom configs here
	{
		plugins: {
			prettier: eslintPluginPrettier
		}
	}
)
