import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveStatus } from "#/entities/archive";
import {
	type Block,
	blocksFromDoc,
	blocksToDoc,
	emptyDoc,
	enqueue,
	type Load,
	type ManuscriptEditing,
	type Queued,
	toEditorContent,
} from "#/entities/manuscript";
import {
	readDraft,
	writeDraftBody,
	writeDraftGoal,
	writeDraftTitle,
} from "../api/draft-storage";

/** 타이핑이 멎고 이만큼 뒤에 저장한다 */
const DEBOUNCE = 300;

interface Patch {
	title?: string;
	goal?: number;
	content?: Content;
}

/**
 * 로그인 없이 쓰는 원고 한 편.
 *
 * 계정 원고를 다루는 `useManuscriptDoc`과 **같은 모양을 내놓는다**(`ManuscriptEditing`).
 * 화면은 어느 쪽을 받았는지 몰라도 되고, 그래서 원고를 쓰는 쪽 코드가 한 벌이다.
 *
 * 여기 없는 것들이 이 모드의 정의다 — 목록도, 옮기기도, 휴지통도, 서버도 없다.
 * 그래서 이 파일은 짧다.
 */
export function useSoloDraft(enabled: boolean): ManuscriptEditing {
	const { report } = useSaveStatus();

	const [load, setLoad] = useState<Load>({ state: "loading" });
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState(0);
	const [editorKey, setEditorKey] = useState(0);

	const docRef = useRef<Content | null>(null);
	const saveTimer = useRef<number | undefined>(undefined);
	/*
	 * 밀린 저장. 계정 원고와 **같은 규칙**을 쓴다(`enqueue`) — 늦게 온 값이 이긴다.
	 * 이쪽은 원고가 한 편뿐이라 임자를 가릴 일이 없어 빈 id를 쓴다.
	 */
	const pending = useRef<Queued<Patch> | null>(null);
	const opened = useRef(false);

	/*
	 * 한 번만 읽는다.
	 *
	 * 다시 읽을 이유가 없다 — 이 원고를 고치는 곳이 이 화면뿐이라 저장소가 저
	 * 혼자 바뀌지 않는다. 다시 읽으면 타이핑 도중에 에디터가 갈린다.
	 */
	useEffect(() => {
		if (!enabled || opened.current) return;
		opened.current = true;

		void readDraft().then((draft) => {
			setTitle(draft.title);
			setGoal(draft.goal);

			const content = toEditorContent(draft.content ?? emptyDoc());
			docRef.current = content;
			setBlocks(blocksFromDoc(content));
			setLoad({ state: "ready", content });
			setEditorKey((k) => k + 1);
		});
	}, [enabled]);

	const save = useCallback(
		(patch: Patch) => {
			if (patch.title !== undefined) report(writeDraftTitle(patch.title));
			if (patch.goal !== undefined) report(writeDraftGoal(patch.goal));
			if (patch.content !== undefined) {
				void writeDraftBody(patch.content).then(report);
			}
		},
		[report],
	);

	const flush = useCallback(() => {
		const job = pending.current;
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;
		if (job) save(job.patch);
	}, [save]);

	const queue = useCallback(
		(patch: Patch) => {
			pending.current = enqueue(pending.current, "", patch);
			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(flush, DEBOUNCE);
		},
		[flush],
	);

	/*
	 * 화면을 떠날 때 마지막 몇 글자를 지킨다. `pagehide`만으로는 모자라서
	 * `visibilitychange`도 듣는다 — 그쪽이 먼저 오고 더 자주 온다.
	 */
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", flush);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [flush]);

	const show = useCallback((content: Content, next: Block[]) => {
		docRef.current = content;
		setBlocks(next);
		setLoad({ state: "ready", content });
		setEditorKey((k) => k + 1);
	}, []);

	return {
		load,
		blocks,
		title,
		goal,
		editorKey,
		content: docRef.current,

		changeTitle: (value) => {
			setTitle(value);
			queue({ title: value });
		},
		changeGoal: (value) => {
			setGoal(value);
			queue({ goal: value });
		},
		changeBody: (next, content) => {
			setBlocks(next);
			docRef.current = content;
			queue({ content });
		},

		replace: (nextTitle, next) => {
			const doc = blocksToDoc(next);
			setTitle(nextTitle);
			show(doc, next);
			queue({ title: nextTitle, content: doc });
		},

		startBlank: () => {
			const doc = blocksToDoc([]);
			show(doc, []);
			queue({ content: doc });
		},

		/* 체험 원고에는 비우는 기능도 이력도 없다. 목록이 없으니 딸려 오는 것도 없다 */
		clearToBlank: () => {},
		reload: () => {},
	};
}
