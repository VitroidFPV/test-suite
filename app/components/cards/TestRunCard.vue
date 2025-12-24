<script setup lang="ts">
import type { Tables } from "~/types/database.types"
import BaseCard from "./BaseCard.vue"

type Run = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">

type RunWithUser = Run & { creator?: UserMetadata }

const props = defineProps<{
	run: RunWithUser
}>()
</script>

<template>
	<BaseCard class="flex flex-col justify-between">
		<template #header>
			<NuxtLink
				:to="`/runs/${props.run.id}`"
				class="font-bold text-primary hover:underline"
			>
				{{ props.run.title }}
			</NuxtLink>
		</template>
		<template #default>
			<div
				class="text-sm text-neutral-500 flex items-center justify-between gap-1"
			>
				<div class="flex items-center gap-1">
					<UAvatar
						:src="props.run.creator?.avatar ?? ''"
						size="sm"
						class="rounded-full"
					/>
					{{ props.run.creator?.username || "Unknown user" }}
				</div>
				<NuxtTime
					:datetime="props.run.created_at"
					class="text-sm text-neutral-500"
					locale="de-DE"
					day="numeric"
					month="2-digit"
					year="numeric"
					hour="2-digit"
					minute="2-digit"
				/>
			</div>
		</template>
	</BaseCard>
</template>
