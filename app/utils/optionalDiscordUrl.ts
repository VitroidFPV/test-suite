import { optionalExternalUrl } from "./optionalExternalUrl"

const discordDomains = ["discord.com", "discordapp.com", "discord.gg"]

export function optionalDiscordUrl(
	value: string | null
): string | null | undefined {
	const url = optionalExternalUrl(value)
	if (!url) return url

	const hostname = new URL(url).hostname
	return discordDomains.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
	)
		? url
		: undefined
}
