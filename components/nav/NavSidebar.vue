<template>
	<aside class="p-4 w-full lg:w-56">
		<ul class="flex lg:flex-col justify-between lg:justify-start space-y-2">
			<li>
				<ULink
					to="/"
					class="px-4 py-3 flex items-center justify-start rounded-lg font-semibold"
					active-class="text-primary bg-primary-500/10 hover:bg-primary-500/20!"
					inactive-class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-500/5"
				>
					<UIcon name="i-lucide-home" class="mr-2 h-6 w-6" />
					Home
				</ULink>
			</li>
			<USeparator class="hidden lg:block" />
			<li>
				<ULink
					to="/cases"
					class="px-4 py-3 flex items-center justify-start rounded-lg font-semibold"
					active-class="text-primary bg-primary-500/10 hover:bg-primary-500/20!"
					inactive-class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-500/5"
				>
					<UIcon name="i-lucide-book-text" class="mr-2 h-6 w-6" />
					Test Cases
				</ULink>
			</li>
			<li>
				<ULink
					to="/plans"
					class="px-4 py-3 flex items-center justify-start rounded-lg font-semibold"
					active-class="text-primary bg-primary-500/10 hover:bg-primary-500/20!"
					inactive-class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-500/5"
				>
					<UIcon name="i-lucide-book-check" class="mr-2 h-6 w-6" />
					Test Plans
				</ULink>
			</li>
			<li>
				<ULink
					to="/run-groups"
					class="px-4 py-3 flex items-center justify-start rounded-lg font-semibold"
					active-class="text-primary bg-primary-500/10 hover:bg-primary-500/20!"
					inactive-class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-500/5"
					:exact="false"
				>
					<UIcon name="i-lucide-library-big" class="mr-2 h-6 w-6" />
					Run Groups
				</ULink>
			</li>
			<li>
				<ULink
					to="/runs"
					class="px-4 py-3 flex items-center justify-start rounded-lg font-semibold"
					active-class="text-primary bg-primary-500/10 hover:bg-primary-500/20!"
					inactive-class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-500/5"
				>
					<UIcon name="i-lucide-book-up" class="mr-2 h-6 w-6" />
					Test Runs
				</ULink>
			</li>
		</ul>
	</aside>
</template>
