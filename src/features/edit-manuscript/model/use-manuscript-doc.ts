import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	mutateIndex,
	readIndex,
	updateDoc,
	useSaveStatus,
	useStoreIndex,
	writeLastOpened,
} from "#/entities/archive";
import {
	type Block,
	blocksFromDoc,
	blocksToDoc,
	docQueryKey,
	layoutBlocks,
	readDoc,
	toEditorContent,
	writeDoc,
} from "#/entities/manuscript";

/** 타이핑이 멎고 이만큼 뒤에 저장한다 */
const DEBOUNCE = 300;

/** 원고를 읽어 본 결과 */
export type Load =
	| { state: "loading" }
	| { state: "ready"; content: Content }
	/** 색인에는 있는데 본문 키가 없다 */
	| { state: "lost" };

interface Patch {
	title?: string;
	goal?: number;
	content?: Content;
	blocks?: Block[];
}

/**
 * 원고 하나를 열고, 고치고, 저장한다.
 *
 * 화면에서 떼어 놓은 이유는 여기 든 것이 전부 시간에 관한 규칙이기 때문이다 —
 * 언제 읽고, 언제까지 미루고, 언제 반드시 밀어 넣는가. 그리는 일과 섞어 두면
 * 어느 쪽이 어느 쪽을 깨뜨렸는지 알 수 없다.
 */
export function useManuscriptDoc(docId: string) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const index = useStoreIndex();
	const { report } = useSaveStatus();

	const [load, setLoad] = useState<Load>({ state: "loading" });
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [title, setTitle] = useState("");
	const [goal, setGoal] = useState(0);
	/*
	 * 에디터를 다시 마운트시키는 열쇠. Tiptap은 만들어진 뒤 content 옵션을 다시
	 * 보지 않으므로, 내용을 갈아끼우려면 새로 만들어야 한다.
	 */
	const [editorKey, setEditorKey] = useState(0);

	const saveTimer = useRef<number | undefined>(undefined);
	// 에디터는 쪽을 바꿀 때 다시 마운트된다. 그때 최신 내용으로 되살리려고 붙든다.
	const docRef = useRef<Content | null>(null);
	/*
	 * 실제로 읽어 들인 원고. 주소의 docId보다 한 박자 늦다.
	 *
	 * 주소가 먼저 바뀌고 내용은 effect에서 따라 들어온다. 그 틈에 옛 에디터가
	 * 내용을 알려 오는데, 그것은 옛 원고 것이다. 주소 대신 이 값을 보고 저장한다.
	 */
	const openedRef = useRef("");
	/** 아직 쓰지 않은 저장. 어느 원고 것인지 함께 들고 있다 */
	const pending = useRef<{ docId: string; patch: Patch } | null>(null);
	/** 화면에 이미 앉힌 원고. 같은 것을 다시 앉히면 타이핑 도중에 에디터가 갈린다 */
	const shownRef = useRef("");

	/**
	 * 본문과 색인을 함께 저장한다. 어느 원고에 쓸지는 인자로 받는다.
	 *
	 * 제목·목표·분량이 색인에도 있어서 저장이 두 키를 건드린다. 목록을 그릴 때
	 * 문서를 열지 않아도 되도록 치른 값이다. 같은 디바운스로 묶어 한 번에 쓴다.
	 *
	 * 본문은 색인에 넣지 않는다. 색인은 원고를 열고 옮길 때마다 통째로 읽고 쓰는
	 * 것이라, 여기에 본문이 섞이면 원고 수만큼 커진다.
	 */
	const save = useCallback(
		(id: string, patch: Patch) => {
			if (!id) return;
			const { content, blocks: counted, ...entry } = patch;

			/*
			 * 색인을 먼저 쓴다. 색인은 localStorage라 동기로 끝나므로, 탭이 닫히는
			 * 중이어도 제목과 분량은 남는다. 본문은 IndexedDB라 기다려야 한다.
			 */
			const stats = counted ? layoutBlocks(counted).stats : undefined;
			const indexed = mutateIndex((current) =>
				updateDoc(current, id, {
					...entry,
					...(stats && { chars: stats.chars, sheets: stats.sheets }),
				}),
			).result;

			if (content === undefined) {
				report(indexed);
				return;
			}

			/*
			 * 캐시도 함께 고친다. 이 원고를 떠났다가 돌아오면 캐시에서 읽는데,
			 * 갱신하지 않으면 방금 쓴 것이 옛것으로 되돌아간 것처럼 보인다.
			 */
			queryClient.setQueryData(docQueryKey(id), content);

			const written = writeDoc(id, content);
			written.then((body) => report(indexed, body));
			return written;
		},
		[report, queryClient],
	);

	/**
	 * 기다리고 있는 저장을 지금 끝낸다.
	 *
	 * 밀린 저장은 자기가 어느 원고 것인지 들고 있다. 원고를 바꾸는 도중에 밀어
	 * 넣어도 옆 원고에 쏟아지지 않는다.
	 */
	const flush = useCallback(() => {
		const job = pending.current;
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;
		if (job) save(job.docId, job.patch);
	}, [save]);

	/**
	 * 나중에 저장한다.
	 *
	 * 본문뿐 아니라 제목과 목표도 여기를 지난다. 전에는 그 둘이 곧바로 썼는데,
	 * 색인은 통째로 읽고 다시 굽는 것이라 제목 한 글자마다 원고 전체 목록을
	 * 다시 썼다.
	 */
	const queue = useCallback(
		(patch: Patch) => {
			const id = openedRef.current;
			// 아직 아무 원고도 못 읽었으면 어디에 쓸지 모른다
			if (!id) return;

			// 같은 원고에 밀려 있던 것과 합친다. 늦게 온 값이 이긴다
			const previous = pending.current;
			pending.current = {
				docId: id,
				patch:
					previous && previous.docId === id
						? { ...previous.patch, ...patch }
						: patch,
			};

			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(flush, DEBOUNCE);
		},
		[flush],
	);

	/**
	 * 주소에 있는 원고의 본문.
	 *
	 * 저장소가 IndexedDB라 기다려야 하는데, **늦게 온 본문이 남의 원고 위에
	 * 얹히는 문제는 여기서 다루지 않는다.** 캐시가 키(`docId`)별로 갈라져 있어
	 * `stored`는 언제나 지금 `docId`의 것이다. 원고를 바꾸면 앞 원고의 읽기가
	 * 늦게 끝나도 그 결과는 앞 원고의 칸으로 들어간다.
	 *
	 * 전에는 이것을 ref로 손수 가렸는데, 그 가림막이 effect의 cleanup과 물려서
	 * 색인이 바뀔 때마다 진행 중인 읽기를 버리고 다시 읽지도 않는 상태가 됐다.
	 */
	const { data: stored, isPending: reading } = useQuery({
		queryKey: docQueryKey(docId),
		queryFn: () => readDoc(docId),
		enabled: Boolean(docId),
	});

	/*
	 * 주소가 가리키는 원고로 갈아탄다. 사이드바에서 다른 원고를 고르면 다시 돈다.
	 *
	 * 저장 중인 것이 있으면 먼저 밀어 넣는다. 디바운스가 아직 안 터진 채로
	 * 원고를 바꾸면 마지막 몇 글자가 사라진다.
	 *
	 * 색인도 의존값에 둔다. 보고 있던 원고가 다른 탭에서 사라지면 여기로 알려
	 * 오는데, 전에는 주소만 보고 있어서 없어진 원고에 계속 쓰고 있었다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: index는 다시 볼 때를 알리는 신호로만 둔다
	useEffect(() => {
		const entry = readIndex().docs.find((d) => d.id === docId);
		if (!entry) {
			// 없는 원고를 가리키는 주소다. 밀린 저장을 버리고 열 수 있는 곳으로 보낸다
			pending.current = null;
			window.clearTimeout(saveTimer.current);
			openedRef.current = "";
			navigate({ to: "/", replace: true });
			return;
		}

		// 이미 열어 둔 원고면 다시 앉히지 않는다. 색인이 바뀔 때마다 되읽으면
		// 타이핑 도중에 에디터가 통째로 갈린다
		if (openedRef.current === docId) return;

		flush();
		openedRef.current = docId;
		writeLastOpened(docId);
		setTitle(entry.title);
		setGoal(entry.goal);
		// 새 본문이 올 때까지 앞 원고를 그대로 두지 않는다
		if (shownRef.current !== docId) setLoad({ state: "loading" });
	}, [docId, index, navigate]);

	/*
	 * 본문이 도착하면 화면에 앉힌다.
	 *
	 * 위 effect와 나눈 이유는 시점이 다르기 때문이다. 제목과 목표는 색인에 있어
	 * 곧바로 알 수 있고, 본문은 기다려야 한다.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: 한 원고를 한 번만 앉힌다
	useEffect(() => {
		if (!docId || reading) return;
		// 이 원고는 이미 앉혔다. 다시 하면 타이핑 도중에 에디터가 갈린다
		if (shownRef.current === docId) return;
		shownRef.current = docId;

		if (stored == null) {
			/*
			 * 본문이 사라졌다. 빈 에디터를 띄우면 그대로 저장되어 마지막 흔적까지
			 * 덮어쓴다. 열지 않고 알린다.
			 */
			docRef.current = null;
			setBlocks([]);
			setLoad({ state: "lost" });
			return;
		}

		const content = toEditorContent(stored);
		docRef.current = content;
		// 에디터를 기다리지 않고 바로 조판한다
		const opened = blocksFromDoc(content);
		setBlocks(opened);
		setLoad({ state: "ready", content });
		setEditorKey((k) => k + 1);

		/*
		 * 목록에 적힌 분량이 실제와 다르면 지금 고쳐 둔다.
		 *
		 * 휴지통에서 되살린 원고가 그렇다. 분량은 본문을 읽어야 나오는 값이라
		 * 꺼낼 때는 셀 수 없어 0자 1매로 적어 두는데, 아무도 다시 세지 않아
		 * 영영 그대로 남았다 — 보관함 용량 표시도 함께 어긋났다.
		 *
		 * `updatedAt`은 건드리지 않는다. 읽기만 했는데 목록에서 맨 위로 올라오면
		 * "최근 수정순"이 거짓말이 된다.
		 */
		const entry = readIndex().docs.find((d) => d.id === docId);
		if (!entry) return;

		const stats = layoutBlocks(opened).stats;
		if (entry.chars !== stats.chars || entry.sheets !== stats.sheets) {
			report(
				mutateIndex((current) =>
					updateDoc(
						current,
						docId,
						{ chars: stats.chars, sheets: stats.sheets },
						entry.updatedAt,
					),
				).result,
			);
		}
	}, [docId, stored, reading]);

	/*
	 * 화면을 떠날 때 마지막 몇 글자를 지킨다.
	 *
	 * `pagehide`만으로는 모자라다. 색인은 localStorage라 동기로 끝나지만 본문은
	 * IndexedDB라, 탭이 닫히는 중에 건 쓰기는 끝나지 못하고 잘릴 수 있다.
	 * `visibilitychange`가 먼저 오고 더 자주 오므로 그쪽에서도 밀어 넣는다 —
	 * 다른 탭으로 옮기거나 앱을 배경으로 내리는 것이 전부 여기로 온다.
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

	/** 화면을 갈아 끼운다. 저장은 부르는 쪽이 따로 시킨다 */
	const showContent = useCallback((content: Content, next: Block[]) => {
		docRef.current = content;
		setBlocks(next);
		setLoad({ state: "ready", content });
		setEditorKey((k) => k + 1);
	}, []);

	/**
	 * 밖에서 이 원고를 비웠다.
	 *
	 * 저장소는 이미 갈렸다. 에디터가 옛 내용을 그대로 들고 있으므로 화면까지
	 * 갈아 끼우지 않으면 다음 타이핑에 되살아난다. 밀린 저장도 함께 버린다.
	 *
	 * 누가 비웠는지는 여기서 알지 않는다 — 비우는 것도 피처, 이것도 피처라
	 * 서로 부를 수 없다. 둘을 아는 쪽(page)이 이어 준다.
	 */
	const clearToBlank = useCallback(
		(resetId: string) => {
			if (resetId !== openedRef.current) return;
			pending.current = null;
			window.clearTimeout(saveTimer.current);

			/*
			 * 캐시도 비운다. 비우는 쪽(resetDoc)은 저장소만 갈아서 캐시는 옛 본문을
			 * 그대로 들고 있다 — 다른 원고에 갔다 돌아오면 방금 비운 것이 되살아난다.
			 */
			const blank = blocksToDoc([]);
			queryClient.setQueryData(docQueryKey(resetId), blank);

			setTitle("");
			setGoal(0);
			showContent(blank, []);
		},
		[showContent, queryClient],
	);

	return {
		load,
		blocks,
		title,
		goal,
		editorKey,
		clearToBlank,
		/** 에디터가 다시 마운트될 때 되살릴 내용 */
		content: docRef.current,

		changeTitle: (value: string) => {
			setTitle(value);
			queue({ title: value });
		},
		changeGoal: (value: number) => {
			setGoal(value);
			queue({ goal: value });
		},
		changeBody: (next: Block[], content: Content) => {
			setBlocks(next);
			docRef.current = content;
			queue({ content, blocks: next });
		},

		/** 불러오기로 통째로 갈아 끼운다 */
		replace: (nextTitle: string, next: Block[]) => {
			const doc = blocksToDoc(next);
			setTitle(nextTitle);
			showContent(doc, next);
			queue({ title: nextTitle, content: doc, blocks: next });
		},

		/** 본문을 잃은 원고를 빈 원고로 되살린다 */
		startBlank: () => {
			const doc = blocksToDoc([]);
			showContent(doc, []);
			queue({ content: doc, blocks: [] });
		},
	};
}
