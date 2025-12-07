<template>
	<UCard
		:ui="{
			root: 'h-full flex flex-col',
			header: 'px-4 py-3 sm:p-4',
			body: 'px-4 py-3 sm:p-4 flex-1',
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
