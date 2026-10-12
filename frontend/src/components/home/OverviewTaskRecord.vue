<template>
	<div class="task-record">
		<div class="record-copy">
			<p class="record-summary">
				{{ record.outcome ?? record.summary }}
			</p>
		</div>
		<div
			v-if="record.artifacts.length"
			class="record-reports"
		>
			<OverviewArtifacts
				:artifacts="record.artifacts"
				:labels="labels"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type {OverviewRecord} from '@/helpers/workspaceOverview'
import OverviewArtifacts from './OverviewArtifacts.vue'

defineProps<{
	record: OverviewRecord,
	labels: Record<string, string>,
}>()
</script>

<style scoped lang="scss">
.record-summary {
	margin: .25rem 0 .45rem;
	font-size: .85rem;
	line-height: 1.55;
}
</style>
