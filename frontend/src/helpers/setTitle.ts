import {getApplicationName} from '@/helpers/workspaceOverview'

export function setTitle(title : undefined | string) {
	document.title = (typeof title === 'undefined' || title === '')
		? getApplicationName()
		: `${title} | ${getApplicationName()}`
}
