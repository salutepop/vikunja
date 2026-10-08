<template>
	<section class="workspace-overview">
		<header class="overview-toolbar">
			<h1>{{ overview.title }}</h1>
			<div class="overview-controls">
				<button
					v-for="mode in ['board', 'projects'] as const"
					:key="mode"
					:aria-pressed="display === mode"
					@click="display = mode"
				>
					{{ overview.labels[mode] }}
				</button>
				<select
					v-model="projectFilter"
					:aria-label="overview.labels.projects"
				>
					<option :value="0">
						{{ overview.labels.all }}
					</option>
					<option
						v-for="project in boardProjects"
						:key="project.id"
						:value="project.id"
					>
						{{ project.title }}
					</option>
				</select>
				<input
					v-model="search"
					type="search"
					:placeholder="overview.labels.search"
					:aria-label="overview.labels.search"
				>
				<button @click="reload">
					{{ overview.labels.refresh }}
				</button>
			</div>
		</header>
		<p class="overview-note">
			{{ overview.note }}
			<time :datetime="overview.checked_at">{{ overview.labels.checked }} {{ checkedAt }}</time>
		</p>
		<p
			v-if="hasError"
			role="alert"
			class="has-text-danger"
		>
			{{ overview.labels.error }}
		</p>
		<p v-if="isLoading">
			{{ overview.labels.loading }}
		</p>
		<div
			v-if="display === 'board' && !isLoading"
			class="overview-board"
			:style="{'--column-count': columns.length}"
		>
			<section
				v-for="column in columns"
				:key="column"
				class="overview-column"
				:data-status="column"
				@dragover="allowDrop($event, column)"
				@drop.prevent="drop(column)"
			>
				<h2>{{ column }} <span>{{ entriesFor(column).length }}</span></h2>
				<div class="column-scroll">
					<article
						v-for="entry in entriesFor(column)"
						:key="entry.task.id"
						class="overview-task"
						:data-task-id="entry.task.id"
					>
						<div class="task-controls">
							<button
								draggable="true"
								class="drag-handle"
								:aria-label="overview.labels.drag"
								:title="overview.labels.drag"
								@dragstart="startDrag($event, entry)"
								@dragend="dragged = null"
							>
								⠿
							</button>
							<span :title="entry.activity.evidence">{{ entry.activity.display }}</span>
							<select
								:value="entry.task.bucket_id"
								:aria-label="overview.labels.move + ': ' + entry.task.title"
								:aria-disabled="move.isPending.value"
								@change="changeStatus($event, entry)"
							>
								<option
									v-for="bucket in entry.buckets"
									:key="bucket.id"
									:value="bucket.id"
								>
									{{ bucket.title }}
								</option>
							</select>
						</div>
						<KanbanCard
							:task="entry.task"
							:project-id="0"
						/>
					</article>
					<p v-if="!entriesFor(column).length">
						{{ overview.labels.empty }}
					</p>
				</div>
			</section>
		</div>
		<div
			v-else-if="display === 'projects'"
			class="overview-projects"
		>
			<article
				v-for="project in visibleProjects"
				:key="project.id"
				class="overview-project"
			>
				<div class="project-summary">
					<h2>
						<RouterLink :to="`/projects/${project.id}/${project.view}`">
							{{ project.title }}
						</RouterLink>
						<small :title="project.activity.evidence">{{ project.activity.display }}</small>
					</h2>
					<p
						class="record-summary"
						:title="project.summary"
					>
						{{ project.summary }}
					</p>
					<p
						class="record-conditions"
						:title="project.conditions"
					>
						<strong>{{ overview.labels.conditions }}</strong> {{ project.conditions }}
					</p>
					<p class="record-next">
						<strong>{{ overview.labels.next }}</strong> {{ project.next }}
					</p>
					<a :href="overviewUrl(project.record_url)">{{ overview.labels.record }}</a>
				</div>
				<div class="project-artifact-scroll">
					<section
						v-for="task in project.tasks"
						:key="task.title"
					>
						<h3>{{ task.title }}</h3>
						<OverviewArtifacts
							:artifacts="task.artifacts"
							:labels="overview.labels"
						/>
					</section>
				</div>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {useMutation, useQueries} from '@tanstack/vue-query'
import {allTasksQuery, type TaskResponse} from '@/client/queries/tasks'
import {useProjects} from '@/composables/useProjects'
import {bucketsQuery} from '@/client/queries/kanban'
import {moveTaskMutationOptions} from '@/client/queries/taskMutations'
import type {Bucket} from '@/client/generated'
import KanbanCard from '@/components/tasks/partials/KanbanCard.vue'
import OverviewArtifacts from './OverviewArtifacts.vue'
import {
	overviewUrl,
	type OverviewActivity,
	type OverviewProject,
	type OverviewRecord,
	type WorkspaceOverview,
} from '@/helpers/workspaceOverview'

const props = defineProps<{overview: WorkspaceOverview}>()
const display = ref<'board' | 'projects'>('board')
const projectFilter = ref(0)
const search = ref('')
const move = useMutation(moveTaskMutationOptions())
const projectList = useProjects()
const boardProjects = computed<OverviewProject[]>(() => projectList.projectsArray
	.filter(project => project.id > 0 && !project.is_archived)
	.flatMap(project => {
		const view = project.views.find(view => view.view_kind === 'kanban')
		if (!view?.id) return []
		const record = props.overview.projects.find(record => record.id === project.id)
		if (record) return [{...record, title: project.title}]
		return [{
			id: project.id,
			view: view.id,
			title: project.title,
			activity: {
				key: (project.updated ?? '').replace('T', ' ').slice(0, 19),
				display: props.overview.labels.app + ' ' + new Date(project.updated ?? 0).toLocaleString(),
				evidence: props.overview.labels.app,
			},
			conditions: '',
			summary: '',
			next: '',
			record_url: window.location.origin + '/projects/' + project.id,
			tasks: [],
		}]
	}).sort((a, b) => b.activity.key.localeCompare(a.activity.key)))
const taskQueries = useQueries({
	queries: computed(() => boardProjects.value.map(project => allTasksQuery({
		project: project.id,
		view: project.view,
		params: {expand: ['comment_count', 'buckets']},
	}))),
})
const bucketQueries = useQueries({
	queries: computed(() => boardProjects.value.map(project => bucketsQuery(project.id, project.view))),
})
const isLoading = computed(() => projectList.isLoading || [...taskQueries.value, ...bucketQueries.value].some(query => query.isPending))
const hasError = computed(() => [...taskQueries.value, ...bucketQueries.value].some(query => query.isError))
const checkedAt = computed(() => new Date(props.overview.checked_at).toLocaleString())

type Entry = {
	task: TaskResponse,
	project: OverviewProject,
	buckets: Bucket[],
	status: string,
	activity: OverviewActivity,
	record?: OverviewRecord,
}
const dragged = ref<Entry | null>(null)

function includesSearch(value: string) {
	return value.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())
}

const entries = computed<Entry[]>(() => boardProjects.value.flatMap((project, index) => {
	const buckets = bucketQueries.value[index].data ?? []
	return (taskQueries.value[index].data ?? []).map(sourceTask => {
		const task = {
			...sourceTask,
			bucket_id: sourceTask.buckets?.find(bucket => bucket.project_view_id === project.view)?.id
				?? sourceTask.bucket_id,
		}
		const record = props.overview.tasks[String(task.id)]
		const status = buckets.find(bucket => bucket.id === task.bucket_id)?.title ?? props.overview.columns[0]
		const activity = record?.activity ?? {
			key: (task.updated ?? '').replace('T', ' ').slice(0, 19),
			display: props.overview.labels.app + ' ' + new Date(task.updated ?? 0).toLocaleString(),
			evidence: props.overview.labels.app,
		}
		return {
			task,
			project,
			buckets,
			status,
			activity,
			record,
		}
	})
}).filter(entry => (!projectFilter.value || entry.project.id === projectFilter.value)
	&& includesSearch([
		entry.task.title,
		entry.project.title,
		entry.record?.summary ?? entry.task.description,
		...(entry.record?.artifacts.map(artifact => artifact.title + ' ' + artifact.path) ?? []),
	].join(' ')))
	.sort((a, b) => b.activity.key.localeCompare(a.activity.key) || b.task.id - a.task.id))

const columns = computed(() => [...new Set([
	...props.overview.columns,
	...entries.value.map(entry => entry.status),
])])
const visibleProjects = computed(() => boardProjects.value.filter(project =>
	(!projectFilter.value || project.id === projectFilter.value)
	&& (project.tasks.length > 0 || entries.value.some(entry => entry.project.id === project.id))
	&& includesSearch([project.title, project.summary, project.conditions,
		...project.tasks.flatMap(task => [task.title, ...task.artifacts.map(artifact => artifact.title + ' ' + artifact.path)]),
	].join(' ')),
))

function entriesFor(status: string) {
	return entries.value.filter(entry => entry.status === status)
}

function reload() {
	window.location.reload()
}

function startDrag(event: DragEvent, entry: Entry) {
	if (move.isPending.value) {
		event.preventDefault()
		return
	}
	dragged.value = entry
	event.dataTransfer?.setData('text/plain', String(entry.task.id))
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

async function moveEntry(entry: Entry, bucket: number) {
	if (move.isPending.value || bucket === entry.task.bucket_id) return
	try {
		await move.mutateAsync({
			project: entry.project.id,
			view: entry.project.view,
			bucket,
			task: entry.task,
		})
	} catch {
		// The mutation wrapper displays the API error and invalidates membership.
	}
}

function allowDrop(event: DragEvent, status: string) {
	if (!move.isPending.value && dragged.value?.buckets.some(bucket => bucket.title === status)) {
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
	}
}

async function drop(status: string) {
	const entry = dragged.value
	dragged.value = null
	if (!entry) return
	const bucket = entry.buckets.find(bucket => bucket.title === status)
	if (typeof bucket?.id === 'number') await moveEntry(entry, bucket.id)
}

async function changeStatus(event: Event, entry: Entry) {
	const select = event.target as HTMLSelectElement
	const bucket = Number(select.value)
	select.value = String(entry.task.bucket_id)
	await moveEntry(entry, bucket)
}
</script>

<style scoped lang="scss">
.workspace-overview {
	text-align: start;
}
.overview-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: .5rem;
	h1 {
		font-size: 1.15rem;
		margin: 0;
	}
}
.overview-controls {
	display: flex;
	flex-wrap: wrap;
	gap: .35rem;
	input, select, button {
		border: 1px solid var(--grey-300);
		border-radius: .25rem;
		background: var(--white);
		color: var(--text);
		font-size: .8rem;
		padding: .35rem .5rem;
	}
	input {
		inline-size: 15rem;
	}
	button[aria-pressed='true'] {
		background: var(--primary);
		color: var(--primary-invert);
	}
}
.overview-note {
	font-size: .75rem;
	color: var(--grey-700);
	margin: .5rem 0;
	time {
		margin-inline-start: .6rem;
	}
}
.overview-board {
	display: grid;
	grid-template-columns: repeat(var(--column-count), minmax(200px, 1fr));
	gap: .55rem;
	overflow-x: auto;
}
.overview-column {
	background: var(--grey-100);
	border: 1px solid var(--grey-300);
	border-radius: .25rem;
	min-inline-size: 0;
	> h2 {
		font-size: .9rem;
		margin: 0;
		padding: .5rem;
		border-block-end: 2px solid var(--primary);
	}
	h2 span {
		font-size: .75rem;
		color: var(--grey-600);
		margin-inline-start: .3rem;
	}
}
.column-scroll {
	padding: .4rem;
	max-block-size: calc(100vh - 15rem);
	overflow-y: auto;
	overscroll-behavior: contain;
}
.overview-task {
	margin-block-end: .55rem;
	border: 1px solid var(--grey-300);
	border-radius: .25rem;
	background: var(--white);
	:deep(.task) {
		box-shadow: none;
	}
	:deep(h3) {
		font-size: .85rem;
		line-height: 1.4;
	}
}
.task-controls {
	display: flex;
	align-items: center;
	gap: .25rem;
	padding: .25rem .35rem;
	border-block-end: 1px solid var(--grey-200);
	font-size: .65rem;
	color: var(--grey-700);
	span {
		flex: 1;
	}
	select {
		font-size: .68rem;
		max-inline-size: 6rem;
		border: 1px solid var(--grey-300);
		background: var(--white);
		color: var(--text);
	}
}
.drag-handle {
	border: 0;
	background: transparent;
	color: var(--grey-600);
	cursor: grab;
	font-size: 1.2rem;
	padding: 0 .15rem;
}
.record-summary, .record-conditions {
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
.artifact-heading, .empty-artifacts {
	font-size: .72rem;
	margin: .35rem 0;
	color: var(--grey-600);
}
.overview-project {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 1rem;
	padding: .65rem;
	background: var(--white);
	border-block-end: 1px solid var(--grey-300);
	h2 {
		font-size: 1rem;
		margin: 0;
	}
	small {
		font-size: .7rem;
		font-weight: normal;
		margin-inline-start: .6rem;
		color: var(--grey-600);
	}
}
.project-artifact-scroll {
	max-block-size: 13rem;
	overflow-y: auto;
	h3 {
		font-size: .75rem;
		margin: .25rem 0;
	}
}
.record-next {
	font-size: .75rem;
	margin: .35rem 0;
}
@media (width <= 850px) {
	.overview-project {
		grid-template-columns: 1fr;
	}
}
</style>
