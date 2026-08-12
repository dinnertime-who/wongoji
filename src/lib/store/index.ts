export {
	requestPersistentStorage,
	type SaveFailure,
	type SaveResult,
	safeGetItem,
	safeSetItem,
} from "./local";
export {
	childrenOf,
	countDocsUnder,
	createDoc,
	createFolder,
	daysLeft,
	displayTitle,
	duplicateDoc,
	moveDoc,
	moveFolder,
	purge,
	renameFolder,
	restore,
	SHEET_LIMIT,
	TRASH_DAYS,
	trashDoc,
	trashFolder,
	updateDoc,
	usedSheets,
} from "./operations";
export { ancestorIds, canMoveFolder, fullPath, ROOT } from "./path";
export {
	type DocContent,
	mutateIndex,
	readDoc,
	readIndex,
	removeDoc,
	tidy,
	writeDoc,
	writeLastOpened,
} from "./store";
export type {
	DocEntry,
	FolderEntry,
	Path,
	StoreIndex,
	TrashEntry,
} from "./types";
export { useStoreIndex } from "./useStoreIndex";
