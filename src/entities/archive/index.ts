export {
	clearIndexIn,
	indexKey,
	indexSnapshot,
	indexUnreadable,
	mutateIndex,
	readIndex,
	readIndexIn,
	readLastOpened,
	subscribeToIndex,
	writeIndex,
	writeLastOpened,
} from "./api/index-storage";
export { TRASH_DAYS } from "./config/limits";
export {
	ancestorIds,
	canMoveFolder,
	fullPath,
	isUnder,
	ROOT,
	settleUnder,
} from "./lib/path";
export {
	childrenOf,
	countDocsUnder,
	createDoc,
	createFolder,
	daysLeft,
	displayTitle,
	duplicateDoc,
	type Moving,
	nudgeEntry,
	type Placement,
	placeEntry,
	purge,
	purgeExpired,
	remapIds,
	renameFolder,
	repairPaths,
	restore,
	trashDoc,
	trashFolder,
	updateDoc,
} from "./model/operations";
export {
	SaveStatusProvider,
	useArchiveMutation,
	useSaveStatus,
} from "./model/save-status";
export {
	type DocEntry,
	emptyIndex,
	type FolderEntry,
	type Path,
	type StoreIndex,
	type TrashEntry,
} from "./model/types";
export { useStoreIndex } from "./model/use-store-index";
export { Breadcrumb } from "./ui/Breadcrumb";
