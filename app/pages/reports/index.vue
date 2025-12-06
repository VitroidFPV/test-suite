<script setup lang="ts">
import type { Database, Tables } from "~/types/database.types"
import TestRunCard from "~/components/cards/TestRunCard.vue"
import BaseCard from "~/components/cards/BaseCard.vue"
import dayjs from "dayjs"

const supabase = useSupabaseClient<Database>()

type Report = Tables<"test_run_reports">
type User = Tables<"user_metadata">

type ReportWithUser = Report & { creator?: User }

const { data: reportsData, error: reportsError } = await useAsyncData(
	"reports",
	async () => {
		const { data, error } = await supabase.from("test_run_reports").select("*")
		if (error) {
			console.error(error)
			return []
		}

		// Get unique creator IDs
		const creatorIds = [...new Set(data.map((report) => report.created_by))]

		// Fetch creator data
		const { data: creatorsData, error: creatorsError } = await supabase.rpc(
			"get_user_metadata",
			{ user_ids: creatorIds }
		)

		if (creatorsError) {
			console.error(creatorsError)
			return data as ReportWithUser[]
		}

		// Map creators to reports
		const reportsWithCreators: ReportWithUser[] = data.map((report) => ({
			...report,
			creator: creatorsData?.find((creator) => creator.id === report.created_by)
		}))

		return reportsWithCreators
	},
	{ lazy: true }
)

useHead({
	title: `Test Reports | Test Suite`
})
</script>

<template>
	<div class="flex flex-col gap-y-6">
		<div class="flex w-full justify-between">
			<h1 class="text-3xl font-bold text-primary">Test Reports</h1>
		</div>

		<!-- <USeparator /> -->

		<div
			v-if="reportsData && reportsData.length > 0"
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<BaseCard
				v-for="item in reportsData"
				:key="item.id"
				class="flex flex-col justify-between"
			>
				<template #header>
					<div class="flex items-center justify-between">
						<NuxtLink
							:to="`/reports/${item.id}`"
							class="font-bold text-primary hover:underline"
						>
							{{ item.title }}
						</NuxtLink>
						<UBadge
							:color="item.pass ? 'success' : 'error'"
							:label="item.pass ? 'Passed' : 'Failed'"
							class="font-semibold"
						/>
					</div>
				</template>
				<template #default>
					<div
						class="text-sm text-neutral-500 flex items-center justify-between gap-1"
					>
						<div class="flex items-center gap-1">
							<UAvatar
								:src="item.creator?.avatar ?? ''"
								size="sm"
								class="rounded-full"
							/>
							{{ item.creator?.username || "Unknown user" }}
						</div>
						<div class="text-sm text-neutral-500">
							{{ dayjs(item.created_at).format("D.MM.YYYY HH:mm") }}
						</div>
					</div>
				</template>
			</BaseCard>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full"
		>
			<div v-for="i in 5" :key="i">
				<BaseCard
					:style="{
						opacity: 1 - i / 10
					}"
				>
					<template #header>
						<div class="font-bold text-primary-500">
							<USkeleton class="w-1/2 h-6" />
						</div>
					</template>
					<template #default>
						<span class="line-clamp-1 text-ellipsis">
							<USkeleton class="h-6 w-full" />
						</span>
					</template>
					<!-- <template #footer>
						<div class="flex items-center justify-between">
							<div class="text-sm text-neutral-500">
								<USkeleton class="w-1/2 h-6" />
							</div>
							<div class="flex items-center gap-2">
								<USkeleton width="w-1/2 h-6" />
							</div>
						</div>
					</template> -->
				</BaseCard>
			</div>
		</div>
	</div>
</template>
