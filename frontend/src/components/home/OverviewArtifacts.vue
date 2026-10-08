<template>
	<ul
		v-if="artifacts.length"
		class="overview-artifacts"
		@click.stop
		@mousedown.stop
		@dragstart.stop
	>
		<li
			v-for="artifact in artifacts"
			:key="artifact.path"
		>
			<a
				:href="overviewUrl(artifact.href)"
				:title="artifact.title + '\n' + artifact.path"
				@click.stop
			>
				{{ artifact.title }}
			</a>
			<span class="artifact-time">
				<time
					v-if="artifact.time.created"
					:datetime="artifact.time.created.iso"
					:title="artifact.time.created.iso + '\n' + artifact.time.created.evidence"
				>
					{{ artifact.time.created.label }} {{ artifact.time.created.short }}
				</time>
				<span v-else>{{ labels.unknown_time }}</span>
				<time
					v-if="artifact.time.modified && artifact.time.modified.iso !== artifact.time.created?.iso"
					:datetime="artifact.time.modified.iso"
					:title="artifact.time.modified.iso + '\n' + artifact.time.modified.evidence"
				>
					{{ labels.updated }} {{ artifact.time.modified.short }}
				</time>
			</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import {
	overviewUrl,
	type OverviewArtifact,
} from '@/helpers/workspaceOverview'

defineProps<{
	artifacts: OverviewArtifact[],
	labels: Record<string, string>,
}>()
</script>

<style scoped lang="scss">
.overview-artifacts {
	list-style: none;
	margin: .35rem 0 0;
	padding: 0;
	max-block-size: 10.25rem;
	overflow-y: auto;
	overscroll-behavior: contain;
	scrollbar-gutter: stable;

	li {
		padding: .35rem 0;
		border-block-end: 1px solid var(--grey-200);
		min-block-size: 3.4rem;
	}

	a {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.35;
		font-size: .8rem;
		font-weight: 500;
		color: var(--primary);
		text-decoration: underline;
	}
}

.artifact-time {
	display: flex;
	flex-wrap: wrap;
	gap: .15rem .5rem;
	font-size: .68rem;
	line-height: 1.4;
	color: var(--grey-700);
}
</style>
