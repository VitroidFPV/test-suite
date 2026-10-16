<script setup lang="ts">
import type { Tables } from "~/types/database.types"
import BaseCard from "./BaseCard.vue"

type Run = Tables<"test_runs">
type UserMetadata = Tables<"user_metadata">
type RunGroup = Pick<Tables<"test_run_groups">, "id" | "title" | "image_url">

type RunWithUser = Run & { creator?: UserMetadata }

const props = defineProps<{
	run: RunWithUser
	groups?: RunGroup[]
}>()

const { dateTimeProps } = useDateTimeFormat()
</script>

<template>
	<BaseCard class="flex flex-col justify-between">
		<template #header>
			<NuxtLink
				:to="`/runs/${props.run.id}`"
				class="font-semibold text-neutral-100 hover:text-primary-400 hover:underline"
			>
				{{ props.run.title }}
			</NuxtLink>
		</template>
		<template #default>
			<div
				class="text-sm text-neutral-400 flex flex-wrap items-center justify-between gap-2"
			>
				<div class="flex flex-wrap items-center gap-2">
					<div class="flex items-center gap-1">
						<UAvatar
							:src="props.run.creator?.avatar ?? ''"
							size="sm"
							class="rounded-full"
						/>
						{{ props.run.creator?.username || "Unknown user" }}
					</div>
					<div
						v-if="props.groups?.length"
						class="flex flex-wrap items-center gap-2"
					>
						<USeparator orientation="vertical" class="h-5" />
						<NuxtLink
							v-for="group in props.groups"
							:key="group.id"
							:to="`/run-groups/${group.id}`"
							class="inline-flex items-center gap-1 hover:text-primary-400 hover:underline"
						>
							<RunGroupImage
								:src="group.image_url"
								:alt="`${group.title} image`"
								size="avatar"
								fallback
							/>
							<span>{{ group.title }}</span>
						</NuxtLink>
					</div>
				</div>
				<NuxtTime
					:datetime="props.run.created_at"
					class="ml-auto text-sm text-neutral-400"
					v-bind="dateTimeProps"
				/>
			</div>
		</template>
	</BaseCard>
</template>
