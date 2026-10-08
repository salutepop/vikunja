export type OverviewTime = {
	iso: string,
	short: string,
	label: string,
	evidence: string,
}

export type OverviewActivity = {
	key: string,
	display: string,
	evidence: string,
}

export type OverviewArtifact = {
	href: string,
	title: string,
	path: string,
	kind: string,
	time: {
		created: OverviewTime | null,
		modified: OverviewTime | null,
	},
}

export type OverviewRecord = {
	activity: OverviewActivity,
	summary: string,
	conditions: string,
	artifacts: OverviewArtifact[],
}

export type OverviewProject = {
	id: number,
	view: number,
	title: string,
	activity: OverviewActivity,
	conditions: string,
	summary: string,
	next: string,
	record_url: string,
	tasks: {
		title: string,
		activity: OverviewActivity,
		artifacts: OverviewArtifact[],
	}[],
}

export type WorkspaceOverview = {
	title: string,
	note: string,
	checked_at: string,
	columns: string[],
	projects: OverviewProject[],
	tasks: Record<string, OverviewRecord>,
	labels: Record<string, string>,
}

declare global {
	interface Window {
		EXTERNAL_WORKSPACE_OVERVIEW?: WorkspaceOverview
	}
}

// Ordinary external links retain the browser's new-tab and modifier-click behavior.
export function overviewUrl(value: string): string | undefined {
	try {
		const url = new URL(value, window.location.origin)
		return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
	} catch {
		return undefined
	}
}
