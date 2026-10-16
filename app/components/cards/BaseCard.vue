<template>
	<UCard
		:ui="{
			root: 'h-full flex flex-col',
			header: 'px-4 pt-4 pb-2 sm:px-5 sm:pt-5 sm:pb-2 border-b-0',
			body: 'px-4 pt-0 pb-4 sm:px-5 sm:pt-0 sm:pb-5 flex-1 text-sm leading-relaxed text-neutral-400',
			footer: 'px-4 py-3 sm:p-4'
		}"
	>
		<template v-if="$slots.header" #header>
			<slot name="header" />
		</template>
		<template v-if="$slots.default" #default>
			<slot name="default" />
		</template>
		<template v-if="$slots.footer" #footer>
			<slot name="footer" />
		</template>
	</UCard>
</template>
