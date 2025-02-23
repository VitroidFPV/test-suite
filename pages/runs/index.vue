<script setup lang="ts">
import type { Database, Tables } from "~/database.types"

const supabase = useSupabaseClient<Database>()

useHead({
	title: `Test Runs | Test Suite`
})
</script>

<template>
	<div>runs</div>
</template>
