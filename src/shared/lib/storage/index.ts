export {
	listStorageKeys,
	requestPersistentStorage,
	type SaveFailure,
	type SaveResult,
	safeGetItem,
	safeRemoveItem,
	safeSetItem,
	savePreference,
} from "./local";
export {
	currentScope,
	keyIn,
	restoreStorageScope,
	type StorageScope,
	scopedDbName,
	scopedKey,
	setStorageScope,
	subscribeToScope,
} from "./scope";
