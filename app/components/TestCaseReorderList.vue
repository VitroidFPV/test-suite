<script setup lang="ts">
type ReorderableCase = {
	id: string
	title: string | null
}

const props = defineProps<{
	cases: ReorderableCase[]
}>()

const emit = defineEmits<{
	reorder: [cases: ReorderableCase[]]
}>()

const localCases = ref<ReorderableCase[]>([])

watch(
	() => props.cases,
	(newCases) => {
		localCases.value = [...newCases]
	},
	{ immediate: true, deep: true }
)

const draggedIndex = ref<number | null>(null)

function moveCase(fromIndex: number, toIndex: number) {
	if (fromIndex === toIndex) {
		return
	}

	const nextCases = [...localCases.value]
	const [movedCase] = nextCases.splice(fromIndex, 1)
	if (!movedCase) {
		return
	}

	nextCases.splice(toIndex, 0, movedCase)
	localCases.value = nextCases
	emit("reorder", nextCases)
}

function onDragStart(index: number) {
	draggedIndex.value = index
}

function onDragOver(event: DragEvent, index: number) {
	event.preventDefault()
	if (draggedIndex.value === null || draggedIndex.value === index) {
		return
	}

	moveCase(draggedIndex.value, index)
	draggedIndex.value = index
}

function onDragEnd() {
	draggedIndex.value = null
}

function moveUp(index: number) {
	if (index <= 0) {
		return
	}

	moveCase(index, index - 1)
}

function moveDown(index: number) {
	if (index >= localCases.value.length - 1) {
		return
	}

	moveCase(index, index + 1)
}
</script>

<template>
	<div class="flex flex-col gap-2 w-full">
		<UCard
			v-for="(item, index) in localCases"
			:key="item.id"
			:ui="{
				root: 'cursor-grab active:cursor-grabbing',
				body: 'px-3 py-2 sm:px-3 sm:py-2'
			}"
			draggable="true"
			@dragstart="onDragStart(index)"
			@dragover="onDragOver($event, index)"
			@dragend="onDragEnd"
		>
			<div class="flex items-center gap-2">
				<UButton
					color="neutral"
					size="xs"
					variant="ghost"
					icon="i-lucide-grip-vertical"
					class="cursor-grab active:cursor-grabbing shrink-0"
					aria-label="Drag to reorder"
					tabindex="-1"
				/>
				<div class="flex-1 min-w-0 font-medium text-primary-500 truncate">
					{{ item.title }}
				</div>
				<div class="flex items-center gap-1 shrink-0">
					<UButton
						color="neutral"
						size="xs"
						variant="ghost"
						icon="i-lucide-chevron-up"
						:disabled="index === 0"
						aria-label="Move up"
						@click="moveUp(index)"
					/>
					<UButton
						color="neutral"
						size="xs"
						variant="ghost"
						icon="i-lucide-chevron-down"
						:disabled="index === localCases.length - 1"
						aria-label="Move down"
						@click="moveDown(index)"
					/>
				</div>
			</div>
		</UCard>
	</div>
</template>
