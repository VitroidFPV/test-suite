<script setup lang="ts">
interface StatusStat {
	title: string
	value: string
	number: number
}

interface Props {
	statusStats: StatusStat[]
}

const props = defineProps<Props>()

const resultTypes = [
	{
		label: "Not Run",
		value: "not_run",
		textColor: "text-neutral-400",
		bgColor: "bg-neutral-500/20"
	},
	{
		label: "Passed",
		value: "passed",
		textColor: "text-lime-500",
		bgColor: "bg-lime-500/20"
	},
	{
		label: "Failed",
		value: "failed",
		textColor: "text-red-400",
		bgColor: "bg-red-500/20"
	},
	{
		label: "Blocked",
		value: "blocked",
		textColor: "text-yellow-400",
		bgColor: "bg-yellow-500/20"
	},
	{
		label: "Skipped",
		value: "skipped",
		textColor: "text-neutral-200",
		bgColor: "bg-neutral-500/20"
	}
]

function getResultType(resultValue: string | null) {
	const result = resultTypes.find((r) => r.value === resultValue)
	return result || resultTypes[0]!
}

function getStatusStatsPercentage(value: string) {
	const valueStats = props.statusStats.find((s) => s.value === value)
	const totalStats = props.statusStats.find((s) => s.value === "total")

	if (!valueStats || !totalStats || totalStats.number === 0) {
		return 0
	}

	return (valueStats.number / totalStats.number) * 100
}
</script>

<template>
	<div class="flex flex-col gap-3">
		<div class="h-2 w-full rounded-full bg-neutral-500/20 flex overflow-hidden">
			<div
				class="h-full bg-lime-500 transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('passed')}%` }"
			></div>
			<div
				class="h-full bg-yellow-500 transition-all duration-200"
				:style="{
					width: `${getStatusStatsPercentage('blocked')}%`
				}"
			></div>
			<div
				class="h-full bg-red-500 transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('failed')}%` }"
			></div>
			<div
				class="h-full transition-all duration-200 stripe-gradient"
				:style="{
					width: `${getStatusStatsPercentage('skipped')}%`
				}"
			></div>
			<div
				class="h-full bg-transparent transition-all duration-200"
				:style="{ width: `${getStatusStatsPercentage('not_run')}%` }"
			></div>
		</div>
		<div class="text-sm text-neutral-400 flex gap-4 flex-wrap">
			<div
				v-for="item in statusStats.filter((s) => s.value !== 'total')"
				:key="item.value"
				class="flex gap-1"
			>
				<UBadge
					:ui="{
						base: `${getResultType(item.value).bgColor} ${getResultType(item.value).textColor} rounded-full`
					}"
					>{{ item.title }}</UBadge
				>
				<span class="text-neutral-400">{{ item.number }}</span>
				<span class="text-neutral-400"
					>({{ getStatusStatsPercentage(item.value) }}%)</span
				>
			</div>
		</div>
	</div>
</template>
