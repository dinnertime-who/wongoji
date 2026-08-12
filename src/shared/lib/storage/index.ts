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
	markScopeSettled,
	restoreStorageScope,
	type StorageScope,
	scopedDbName,
	scopedKey,
	scopeSettled,
	setStorageScope,
	subscribeToScope,
} from "./scope";
export { useScopeSettled } from "./use-scope-settled";
