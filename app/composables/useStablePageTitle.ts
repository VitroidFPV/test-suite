import { toValue, watchEffect, type MaybeRefOrGetter } from "vue"

type StablePageTitleOptions = {
	title: MaybeRefOrGetter<string | null | undefined>
	ready?: MaybeRefOrGetter<boolean>
}

export function useStablePageTitle(options: StablePageTitleOptions) {
	const stablePageTitle = useState<string | undefined>("stable-page-title")

	if (import.meta.client && !stablePageTitle.value) {
		const currentTitle = document.title.trim()
		if (currentTitle) {
			stablePageTitle.value = currentTitle
		}
	}

	watchEffect(() => {
		const isReady = options.ready ? toValue(options.ready) : true
		const candidateTitle = toValue(options.title)?.trim()

		if (isReady && candidateTitle) {
			stablePageTitle.value = candidateTitle
		}
	})
}
