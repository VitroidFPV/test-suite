<template>
	<main class="h-screen">
		<NavHeader />
		<div class="flex flex-col lg:flex-row">
			<NavSidebar />
			<div class="p-3 w-full h-full">
				<slot />
			</div>
		</div>
	</main>
</template>
