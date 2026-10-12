<template>
	<section class="workspace-overview">
		<header class="overview-toolbar">
			<div class="workspace-brand">
				<svg
					class="brand-symbol"
					viewBox="0 0 32 32"
					aria-hidden="true"
				>
					<rect
						width="32"
						height="32"
						rx="9"
						fill="currentColor"
					/>
					<path :d="overview.brand?.symbol_path ?? 'M9 9h8a4 4 0 0 1 0 8H9zm0 8h9a3 3 0 0 1 0 6H9V9'" />
				</svg>
				<div>
					<h1>{{ overview.brand?.name ?? overview.title }}</h1>
					<p v-if="overview.brand?.subtitle">
						{{ overview.brand.subtitle }}
					</p>
				</div>
			</div>
			<div class="overview-controls">
				<button
					v-for="mode in ['board', 'projects'] as const"
					:key="mode"
					:aria-pressed="display === mode"
					@click="display = mode"
				>
					{{ overview.labels[mode] }}
				</button>
				<input
					v-model="search"
					type="search"
					:placeholder="overview.labels.search"
					:aria-label="overview.labels.search"
				>
				<button @click="orientation = orientation === 'vertical' ? 'horizontal' : 'vertical'">
					{{ orientation === 'vertical' ? overview.labels.horizontal : overview.labels.vertical }}
				</button>
				<RouterLink to="/projects">
					{{ overview.labels.menu }}
				</RouterLink>
				<button @click="reload">
					{{ overview.labels.refresh }}
				</button>
			</div>
		</header>
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
			:class="{'is-vertical': orientation === 'vertical'}"
			:style="{'--column-count': columns.length}"
		>
			<section
				v-for="column in columns"
				:key="column"
				class="overview-column"
				:style="{'--status-accent': overview.column_colors?.[column] ?? '#5265cc'}"
				:data-status="column"
				@dragover="allowDrop($event, column)"
				@drop.prevent="drop(column)"
			>
				<h2>
					<button
						class="status-target"
						:title="overview.labels.select_first"
						@click="moveSelected(column)"
					>
						{{ column }} <span>{{ entriesFor(column).length }}</span>
					</button>
				</h2>
				<div class="column-scroll">
					<article
						v-for="entry in entriesFor(column)"
						:key="entry.task.id"
						class="overview-task"
						:class="{'is-selected': selectedTask === entry.task.id}"
						:data-task-id="entry.task.id"
						draggable="true"
						@dragstart="startDrag($event, entry)"
						@dragend="dragged = null"
					>
						<div class="task-controls">
							<span class="task-project">{{ entry.project.title }}</span>
							<time :title="entry.activity.evidence">{{ entry.activity.display }}</time>
							<button
								:aria-label="overview.labels.choose_task + ': ' + entry.task.title"
								:aria-pressed="selectedTask === entry.task.id"
								@click="selectedTask = selectedTask === entry.task.id ? null : entry.task.id"
							>
								{{ overview.labels.move }}
							</button>
						</div>
						<h3>
							<RouterLink
								:to="{name: 'task.detail', params: {id: entry.task.id}}"
								@click.exact.prevent="openTask(entry.task.id)"
							>
								{{ entry.record?.headline ?? entry.task.title }}
							</RouterLink>
						</h3>
						<OverviewTaskRecord
							v-if="entry.record"
							:record="entry.record"
							:labels="overview.labels"
						/>
					</article>
					<p
						v-if="!entriesFor(column).length"
						class="empty-state"
					>
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
import {useRouter} from 'vue-router'
import OverviewTaskRecord from './OverviewTaskRecord.vue'
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
const orientation = ref<'vertical' | 'horizontal'>('vertical')

const selectedTask = ref<number | null>(null)
const router = useRouter()
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

function openTask(id: number) {
	router.push({
		name: 'task.detail',
		params: {id},
		state: {backdropView: '/'},
	})
}

async function moveSelected(status: string) {
	const id = selectedTask.value
	const entry = entries.value.find(entry => entry.task.id === id)
	const bucket = entry?.buckets.find(bucket => bucket.title === status)
	if (!entry || typeof bucket?.id !== 'number') return
	await moveEntry(entry, bucket.id)
	if (selectedTask.value === id) selectedTask.value = null
}

</script>

<style scoped lang="scss">
.workspace-overview {
	font-family: 'Pretendard Variable', system-ui, sans-serif;
	color: var(--workspace-ink, #223047);
	text-align: start;
	max-inline-size: 1680px;
	margin-inline: auto;
}
.overview-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding-block: .3rem 1.1rem;
}
.workspace-brand {
	display: flex;
	align-items: center;
	gap: .7rem;
	h1 {
		font-size: 1.55rem;
		font-weight: 750;
		letter-spacing: -.04em;
		line-height: 1.05;
		margin: 0;
	}
	p {
		margin: .25rem 0 0;
		font-size: .7rem;
		color: var(--workspace-muted);
		letter-spacing: .03em;
	}
}
.brand-symbol {
	inline-size: 36px;
	block-size: 36px;
	color: #223047;
	path {
		stroke: #f0f4ff;
		stroke-width: 1.8;
		stroke-linejoin: round;
		fill: none;
	}
}
.overview-controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: .35rem;
	input, button, a {
		border: 1px solid var(--workspace-border);
		border-radius: 9px;
		background: #ffffff;
		color: #637086;
		font-size: .8rem;
		font-weight: 550;
		padding: .55rem .8rem;
		line-height: 1;
		block-size: 35px;
		text-decoration: none;
		transition: background .15s, border-color .15s, color .15s;
	}
	button, a {
		cursor: pointer;
		&:hover {
			background: #f0f3fb;
			border-color: #cbd4e7;
			color: #223047;
		}
		&:focus-visible {
			outline: 2px solid #5265cc;
			outline-offset: 2px;
		}
	}
	input {
		inline-size: 16rem;
		background: #edf1f7;
		border-color: transparent;
		&:focus {
			outline: 2px solid #c9d2f9;
			background: #ffffff;
		}
	}
	button[aria-pressed='true'] {
		background: #e9edfb;
		color: #4355b1;
		border-color: #d4dcf7;
	}
}
.overview-board {
	display: grid;
	grid-template-columns: repeat(var(--column-count), minmax(230px, 1fr));
	gap: .8rem;
	overflow-x: auto;
}
.overview-column {
	min-inline-size: 0;
	border-radius: 13px;
	background: #eef2f8;
	border: 1px solid #e6ebf3;
	> h2 {
		margin: 0;
		padding: .75rem;
		font-size: .83rem;
		font-weight: 650;
	}
}
.status-target {
	display: inline-flex;
	align-items: center;
	gap: .4rem;
	color: var(--workspace-ink);
	border: 0;
	background: transparent;
	padding: 0;
	font: inherit;
	cursor: pointer;
	&::before {
		content: '';
		inline-size: 6px;
		block-size: 6px;
		border-radius: 50%;
		background: var(--status-accent);
	}
	span {
		font-size: .7rem;
		font-weight: 600;
		background: #ffffff;
		color: var(--workspace-muted);
		border-radius: 5px;
		padding: .12rem .35rem;
	}
	&:focus-visible {
		outline: 2px solid var(--status-accent);
		outline-offset: 4px;
	}
}
.column-scroll {
	padding: .25rem .55rem .55rem;
	max-block-size: calc(100vh - 8rem);
	overflow-y: auto;
	overscroll-behavior: contain;
}
.overview-task {
	margin-block-end: .55rem;
	padding: .65rem .95rem;
	border: 1px solid #e5eaf2;
	border-radius: 10px;
	background: #ffffff;
	box-shadow: 0 1px 3px #1b2b4810;
	container-type: inline-size;
	cursor: grab;
	transition: border-color .15s, box-shadow .15s;
	&:hover {
		border-color: #cbd5e7;
		box-shadow: 0 3px 12px #1b2b4812;
	}
	h3 {
		font-size: .95rem;
		line-height: 1.45;
		font-weight: 650;
		letter-spacing: -.015em;
		margin: .4rem 0 .15rem;
		a {
			color: #223047;
			text-decoration: none;
			&:hover {
				color: #5265cc;
			}
		}
	}
	&.is-selected {
		border-color: #5265cc;
		box-shadow: 0 0 0 2px #e2e7ff;
	}
	&:last-child {
		margin-block-end: 0;
	}
}
.task-controls {
	display: flex;
	align-items: center;
	gap: .5rem;
	font-size: .68rem;
	color: #65748a;
	.task-project {
		font-weight: 550;
		color: #637690;
		background: #f2f5fa;
		border-radius: 5px;
		padding: .16rem .4rem;
	}
	time {
		margin-inline-start: auto;
		font-variant-numeric: tabular-nums;
	}
	button {
		border: 0;
		background: transparent;
		font: inherit;
		color: #65748a;
		padding: .2rem .35rem;
		border-radius: 5px;
		cursor: pointer;
		&:hover, &[aria-pressed='true'] {
			background: #edf1fc;
			color: #4355b1;
		}
	}
}
.overview-board.is-vertical {
	grid-template-columns: 1fr;
	gap: .65rem;
	.overview-column {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		> h2 {
			padding: .9rem .85rem;
		}
	}
	.column-scroll {
		padding: .5rem;
		max-block-size: none;
	}
}
.empty-state {
	font-size: .75rem;
	color: #69798f;
	padding: .3rem;
	margin: 0;
}
.overview-project {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 1.2rem;
	padding: 1rem 1.2rem;
	margin-block-end: .7rem;
	background: #ffffff;
	border: 1px solid #e5eaf2;
	border-radius: 12px;
	h2 {
		font-size: 1rem;
		font-weight: 650;
		margin: 0;
		a {
			color: #223047;
		}
	}
	small {
		font-size: .7rem;
		font-weight: 400;
		margin-inline-start: .6rem;
		color: #69798f;
	}
}
.record-summary, .record-conditions, .record-next {
	font-size: .8rem;
	line-height: 1.6;
	margin: .35rem 0;
	color: #637086;
}
.record-summary {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.project-artifact-scroll {
	max-block-size: 13rem;
	overflow-y: auto;
	h3 {
		font-size: .75rem;
		font-weight: 550;
		margin: .25rem 0;
	}
}
@media (width <= 850px) {
	.overview-project {
		grid-template-columns: 1fr;
	}
}
@media (width <= 600px) {
	.overview-controls {
		input {
			inline-size: 100%;
		}
	}
	.overview-board.is-vertical {
		.overview-column {
			grid-template-columns: 1fr;
			> h2 {
				padding: .6rem .75rem;
			}
		}
	}
	.task-controls time {
		font-size: .6rem;
	}
}
</style>
