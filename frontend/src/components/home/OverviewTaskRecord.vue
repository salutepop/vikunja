<template>
	<div class="task-record">
		<p
			class="record-summary"
			:title="record.summary"
		>
			{{ record.summary }}
		</p>
		<p
			class="record-conditions"
			:title="record.conditions"
		>
			<strong>{{ labels.conditions }}</strong> {{ record.conditions }}
		</p>
		<div class="artifact-heading">
			{{ labels.artifacts }} <span>{{ record.artifacts.length }}</span>
		</div>
		<OverviewArtifacts
			:artifacts="record.artifacts"
			:labels="labels"
		/>
		<p
			v-if="!record.artifacts.length"
			class="empty-artifacts"
		>
			{{ labels.no_artifacts }}
		</p>
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
.record-summary,
.record-conditions {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	overflow: hidden;
	line-height: 1.45;
	margin: .4rem 0;
	font-size: .8rem;
}

.record-summary {
	-webkit-line-clamp: 4;
}

.record-conditions {
	-webkit-line-clamp: 2;
	font-size: .72rem;
	color: var(--grey-700);
}

.artifact-heading,
.empty-artifacts {
	font-size: .72rem;
	margin: .35rem 0;
	color: var(--grey-600);
}
</style>
