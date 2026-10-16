<script setup lang="ts">
import VueMarkdown from "vue-markdown-render"
import type { ResultType } from "~/types/resultTypes"
import type { CasePriority } from "~/utils/calculateReportOutcome"
import type { ButtonProps } from "@nuxt/ui"

interface RunCaseWithResult {
	id: string
	title: string
	text: string | null
	case_id: number | null
	created_at: string
	result: ResultType | null
	comment: string | null
	priority?: CasePriority | null
}

interface Props {
	runCase: RunCaseWithResult
	readonly?: boolean
	hidePriority?: boolean
	selected?: boolean
	expanded?: boolean
	individual?: boolean
	individualIndex?: number
	totalCases?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
	updateResult: [caseId: string, newResult: ResultType]
	updateComment: [caseId: string, newComment: string]
	toggleExpanded: [caseId: string]
}>()

const resultTypes: {
	label: string
	value: ResultType
	textColor: string
	bgColor: string
	hoverBgColor: string
	outlineColor: string
	icon: string
	color: ButtonProps["color"]
	key: string
}[] = [
	{
		label: "Not Run",
		value: "not_run",
		textColor: "text-neutral-100",
		bgColor: "bg-neutral-500/20",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-dot-dashed",
		color: "neutral",
		key: "1"
	},
	{
		label: "Passed",
		value: "passed",
		textColor: "text-lime-500",
		bgColor: "bg-lime-500/20",
		hoverBgColor: "hover:bg-lime-500/30",
		outlineColor: "outline-lime-500/50",
		icon: "i-lucide-circle-check",
		color: "success",
		key: "2"
	},
	{
		label: "Failed",
		value: "failed",
		textColor: "text-red-400",
		bgColor: "bg-red-500/20",
		hoverBgColor: "hover:bg-red-500/30",
		outlineColor: "outline-red-500/50",
		icon: "i-lucide-circle-x",
		color: "error",
		key: "3"
	},
	{
		label: "Blocked",
		value: "blocked",
		textColor: "text-yellow-400",
		bgColor: "bg-yellow-500/20",
		hoverBgColor: "hover:bg-yellow-500/30",
		outlineColor: "outline-yellow-500/50",
		icon: "i-lucide-circle-alert",
		color: "warning",
		key: "4"
	},
	{
		label: "Skipped",
		value: "skipped",
		textColor: "text-neutral-400",
		bgColor: "stripe-gradient",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-arrow-right",
		color: "neutral",
		key: "5"
	}
]

function getResultType(resultValue: ResultType | null) {
	const result = resultTypes.find((r) => r.value === resultValue)
	return result || resultTypes[0]!
}

const localCollapsibleOpen = ref(false)
const localComment = ref(props.runCase.comment || "")
const collapsibleOpen = computed({
	get: () => props.expanded ?? localCollapsibleOpen.value,
	set: (value: boolean) => {
		if (props.expanded !== undefined) {
			if (value !== props.expanded) {
				emit("toggleExpanded", props.runCase.id)
			}
			return
		}

		localCollapsibleOpen.value = value
	}
})

// Watch for external changes to the comment
watch(
	() => props.runCase.comment,
	(newComment) => {
		localComment.value = newComment || ""
	}
)

function handleResultChange(caseId: string, newResult: unknown) {
	emit("updateResult", caseId, newResult as ResultType)
}

function handleCommentUpdate() {
	emit("updateComment", props.runCase.id, localComment.value)
}

function toggleCollapsible() {
	collapsibleOpen.value = !collapsibleOpen.value
}
</script>

<template>
	<UCard
		v-if="!props.individual"
		:class="{ 'outline-2 outline-primary-500/50': props.selected }"
		:ui="{
			root: 'h-auto',
			header: 'px-4 py-3',
			body: 'px-4 py-2 sm:px-4',
			footer: 'px-4 py-3 sm:p-4'
		}"
	>
		<template #default>
			<div class="flex flex-col">
				<div class="flex items-center justify-between gap-3 w-full">
					<div class="flex flex-col min-w-0">
						<UButton
							class="min-w-0 text-left font-medium"
							variant="ghost"
							color="neutral"
							:ui="{
								base: 'p-1 text-base cursor-pointer text-neutral-100 hover:text-primary-400 whitespace-normal justify-start'
							}"
							@click="toggleCollapsible"
						>
							{{ props.runCase.title }}
						</UButton>
						<span
							v-if="!props.hidePriority"
							class="text-xs text-neutral-400 whitespace-nowrap"
						>
							{{
								(props.runCase.priority ?? "medium").replace(/^./, (letter) =>
									letter.toUpperCase()
								)
							}}
							priority
						</span>
					</div>
					<div class="flex items-center gap-2 shrink-0">
						<UTooltip v-if="props.runCase.comment?.trim()" text="Has a comment">
							<UIcon
								name="i-lucide-message-square"
								class="size-4 text-neutral-400"
							/>
						</UTooltip>
						<USelectMenu
							v-if="!props.readonly"
							:model-value="getResultType(props.runCase.result)"
							:items="resultTypes"
							variant="none"
							:ui="{
								// it's impressive that I can get this low into it but damn
								base: `relative *:flex *:items-center *:gap-2 w-36 px-2 py-1 rounded-full ${getResultType(props.runCase.result).textColor} ${getResultType(props.runCase.result).bgColor} ${getResultType(props.runCase.result).outlineColor} ${getResultType(props.runCase.result).hoverBgColor}`,
								trailingIcon: `group-data-[state=open]:rotate-180 transition-transform duration-200 ${getResultType(props.runCase.result).textColor}`,
								item: `data-highlighted:not-data-disabled:before:bg-transparent`,
								content: `max-h-none`
							}"
							@update:model-value="
								(newResult) => {
									handleResultChange(
										props.runCase.id,
										newResult.value as ResultType
									)
								}
							"
						>
							<template #default>
								<div :class="`font-semibold text-sm`">
									<UIcon :name="getResultType(props.runCase.result).icon" />
									{{ getResultType(props.runCase.result).label }}
								</div>
							</template>
							<template #item="{ item: resultItem }">
								<div
									:class="
										`font-semibold text-sm ${resultItem.textColor} flex items-center w-full flex-nowrap
											gap-2 ${resultItem.bgColor} ${resultItem.hoverBgColor} backdrop-opacity-10 px-2 py-1 rounded-full cursor-pointer` +
										(resultItem.value ===
										getResultType(props.runCase.result).value
											? ` outline-2 ${resultItem.outlineColor}`
											: '')
									"
								>
									<UIcon :name="resultItem.icon" class="h-4 w-4 shrink" />
									<div class="whitespace-nowrap">{{ resultItem.label }}</div>
								</div>
							</template>
						</USelectMenu>
						<div
							v-else
							:class="`font-semibold text-sm px-2 py-1 rounded-full flex items-center gap-2 w-24
							${getResultType(props.runCase.result).textColor} ${getResultType(props.runCase.result).bgColor} ${getResultType(props.runCase.result).outlineColor} ${getResultType(props.runCase.result).hoverBgColor}`"
						>
							<UIcon
								:name="getResultType(props.runCase.result).icon"
								class="h-4 w-4 shrink"
							/>
							{{ getResultType(props.runCase.result).label }}
						</div>
						<UButton
							color="neutral"
							size="sm"
							variant="soft"
							icon="i-lucide-chevron-down"
							:ui="{
								leadingIcon: `transition-transform duration-200 ${collapsibleOpen ? 'rotate-180' : ''}`
							}"
							@click="toggleCollapsible"
						/>
					</div>
				</div>
				<UCollapsible v-model:open="collapsibleOpen">
					<template #content>
						<div class="flex flex-col md:flex-row gap-4 w-full pt-3">
							<div class="flex flex-col gap-1 min-w-0 flex-1">
								<div class="text-sm text-neutral-400">
									Test Case Description
								</div>
								<div class="md h-full bg-neutral-800/50 p-2 rounded-md">
									<VueMarkdown
										v-if="props.runCase.text"
										:source="props.runCase.text"
									>
									</VueMarkdown>
									<div v-else class="opacity-50">No description</div>
								</div>
							</div>
							<!-- textarea for comment -->
							<div
								v-if="!props.readonly"
								class="flex flex-col gap-1 min-w-0 flex-1"
							>
								<div class="text-sm text-neutral-400">Test Case Comment</div>
								<UTextarea
									v-model="localComment"
									color="primary"
									variant="soft"
									placeholder="Add a comment about this test result..."
									:rows="5"
									autoresize
									@blur="handleCommentUpdate"
								/>
							</div>
							<div
								v-else-if="props.runCase.comment"
								class="flex flex-col gap-1 min-w-0 flex-1"
							>
								<div class="text-sm text-neutral-400">Test Case Comment</div>
								<div class="md h-full bg-neutral-800/50 p-2 rounded-md">
									<VueMarkdown
										v-if="props.runCase.comment"
										:source="props.runCase.comment"
									>
									</VueMarkdown>
								</div>
							</div>
						</div>
					</template>
				</UCollapsible>
			</div>
		</template>
	</UCard>

	<div v-else class="flex flex-col gap-4 w-full h-full justify-between">
		<div class="flex flex-col gap-4">
			<div class="flex gap-2 lg:items-end lg:mb-2 lg:flex-row flex-col">
				<span
					v-if="
						props.individualIndex !== undefined &&
						props.totalCases !== undefined
					"
					class="text-sm text-neutral-500 whitespace-nowrap font-mono"
				>
					<span class="text-xl">{{ props.individualIndex + 1 }}</span
					>/{{ props.totalCases }}
				</span>
				<h3 class="text-neutral-100 font-semibold lg:text-2xl text-xl">
					{{ props.runCase.title }}
				</h3>
				<span class="text-xs text-neutral-400"
					>{{
						(props.runCase.priority ?? "medium").replace(/^./, (letter) =>
							letter.toUpperCase()
						)
					}}
					priority</span
				>
			</div>
			<div class="grid grid-cols-2 lg:grid-cols-5 gap-2 w-full">
				<UButton
					v-for="result in resultTypes"
					:key="result.value"
					:color="result.color"
					variant="soft"
					:icon="result.icon"
					:ui="{
						base: `w-full min-h-12 text-sm items-center justify-center ring-2
						${result.value === props.runCase.result ? `` : 'ring-transparent'}
						${result.value === 'skipped' ? `${getResultType('skipped').bgColor} bg-transparent` : ''}
						`
					}"
					@click="handleResultChange(props.runCase.id, result.value)"
				>
					{{ result.label }}
					<UKbd :color="result.color" variant="subtle">{{ result.key }}</UKbd>
				</UButton>
			</div>
			<VueMarkdown
				v-if="props.runCase.text"
				:source="props.runCase.text"
				class="text-sm md leading-relaxed max-w-4xl"
			>
			</VueMarkdown>
			<div v-else class="opacity-50">No description</div>
		</div>

		<div class="flex flex-col gap-4">
			<div v-if="!props.readonly" class="flex flex-col gap-1 w-full">
				<div class="text-sm text-neutral-400">Test Case Comment</div>
				<UTextarea
					v-model="localComment"
					color="primary"
					variant="soft"
					placeholder="Add a comment about this test result..."
					:rows="3"
					autoresize
					@blur="handleCommentUpdate"
				/>
			</div>
			<div v-else class="flex flex-col gap-1 w-full">
				<div class="text-sm text-neutral-400">Test Case Comment</div>
				<div class="md h-full bg-neutral-800/50 p-2 rounded-md">
					<VueMarkdown
						v-if="props.runCase.comment"
						:source="props.runCase.comment"
					>
					</VueMarkdown>
				</div>
			</div>
		</div>
	</div>
</template>
