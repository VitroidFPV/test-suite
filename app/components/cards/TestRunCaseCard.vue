<script setup lang="ts">
import BaseCard from "~/components/cards/BaseCard.vue"
import VueMarkdown from "vue-markdown-render"
import type Options from "vue-markdown-render"

const options: typeof Options = {
	html: true
}

interface RunCaseWithResult {
	id: string
	title: string
	text: string | null
	case_id: number | null
	created_at: string
	result: string | null
	comment: string | null
}

interface Props {
	runCase: RunCaseWithResult
	readonly?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
	updateResult: [caseId: string, newResult: string]
	updateComment: [caseId: string, newComment: string]
}>()

const resultTypes = [
	{
		label: "Not Run",
		value: "not_run",
		textColor: "text-neutral-400",
		bgColor: "bg-neutral-500/20",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-dot-dashed"
	},
	{
		label: "Passed",
		value: "passed",
		textColor: "text-lime-400",
		bgColor: "bg-lime-500/20",
		hoverBgColor: "hover:bg-lime-500/30",
		outlineColor: "outline-lime-500/50",
		icon: "i-lucide-circle-check"
	},
	{
		label: "Failed",
		value: "failed",
		textColor: "text-red-400",
		bgColor: "bg-red-500/20",
		hoverBgColor: "hover:bg-red-500/30",
		outlineColor: "outline-red-500/50",
		icon: "i-lucide-circle-x"
	},
	{
		label: "Blocked",
		value: "blocked",
		textColor: "text-yellow-400",
		bgColor: "bg-yellow-500/20",
		hoverBgColor: "hover:bg-yellow-500/30",
		outlineColor: "outline-yellow-500/50",
		icon: "i-lucide-circle-alert"
	},
	{
		label: "Skipped",
		value: "skipped",
		textColor: "text-neutral-200",
		bgColor: "stripe-gradient",
		hoverBgColor: "hover:bg-neutral-500/30",
		outlineColor: "outline-neutral-500/50",
		icon: "i-lucide-circle-arrow-right"
	}
]

function getResultType(resultValue: string | null) {
	const result = resultTypes.find((r) => r.value === resultValue)
	return result || resultTypes[0]!
}

const collapsibleOpen = ref(false)
const localComment = ref(props.runCase.comment || "")

// Watch for external changes to the comment
watch(
	() => props.runCase.comment,
	(newComment) => {
		localComment.value = newComment || ""
	}
)

console.log(props.runCase)

function handleResultChange(caseId: string, newResult: string) {
	emit("updateResult", caseId, newResult)
}

function handleCommentUpdate() {
	emit("updateComment", props.runCase.id, localComment.value)
}
</script>

<template>
	<BaseCard>
		<template #default>
			<div class="flex flex-col">
				<div class="flex items-center justify-between w-full">
					<UButton
						class="font-bold"
						variant="ghost"
						color="neutral"
						:ui="{
							base: `p-1 text-base cursor-pointer ${getResultType(props.runCase.result).textColor} `
						}"
						@click="collapsibleOpen = !collapsibleOpen"
					>
						{{ props.runCase.title }}
					</UButton>
					<div class="flex items-center gap-2">
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
									handleResultChange(props.runCase.id, newResult.value)
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
							@click="collapsibleOpen = !collapsibleOpen"
						/>
					</div>
				</div>
				<UCollapsible :open="collapsibleOpen">
					<template #content>
						<div class="flex gap-4 w-full mt-3">
							<div class="flex flex-col gap-1 w-1/2">
								<div class="text-sm text-neutral-400">
									Test Case Description
								</div>
								<div class="md h-full bg-neutral-800/50 p-2 rounded-md">
									<VueMarkdown
										v-if="props.runCase.text"
										:options="options"
										:source="props.runCase.text"
									>
									</VueMarkdown>
									<div v-else class="opacity-50">No description</div>
								</div>
							</div>
							<!-- textarea for comment -->
							<div v-if="!props.readonly" class="flex flex-col gap-1 w-1/2">
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
							<div v-else class="flex flex-col gap-1 w-1/2">
								<div class="text-sm text-neutral-400">Test Case Comment</div>
								<div class="md h-full bg-neutral-800/50 p-2 rounded-md">
									<VueMarkdown
										v-if="props.runCase.comment"
										:options="options"
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
	</BaseCard>
</template>
