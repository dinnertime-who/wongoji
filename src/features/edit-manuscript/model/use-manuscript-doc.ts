import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Content } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	useArchive,
	useArchiveMutation,
	useSaveStatus,
} from "#/entities/archive";
import {
	type Block,
	blocksFromDoc,
	blocksToDoc,
	docQueryKey,
	enqueue,
	type Load,
	layoutBlocks,
	type ManuscriptEditing,
	type Queued,
	readDoc,
	toEditorContent,
	writeDoc,
} from "#/entities/manuscript";
import {
	NOTHING_OPEN,
	type OpenEvent,
	type Effect as OpeningEffect,
	step,
} from "./opening";

/** 타이핑이 멎고 이만큼 뒤에 저장한다 */
const DEBOUNCE = 300;

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
 *
 * **"지금 어느 국면인가"는 이 파일이 정하지 않는다.** 그 판단은 순수 함수
 * (`opening.ts`)에 있고 여기서는 그것이 시키는 일을 할 뿐이다. 전에는 ref 넷이
 * 국면을 나눠 들고 있어서, 여는 순서가 어긋나 난 버그를 재현하려면 브라우저에서
 * 손으로 원고를 빠르게 오가는 수밖에 없었다.
 */
export function useManuscriptDoc(docId: string): ManuscriptEditing {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { index, isPending: loadingIndex } = useArchive();
	const change = useArchiveMutation();
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
	/** 아직 쓰지 않은 저장. 어느 원고 것인지 함께 들고 있다 */
	const pending = useRef<Queued<Patch> | null>(null);

	/*
	 * 여는 일이 어디까지 왔는가. 다시 그릴 이유가 아니므로 ref에 든다 — 화면에
	 * 보이는 것은 이것이 시킨 결과(`load`·`blocks`·`title`)뿐이다.
	 */
	const opening = useRef(NOTHING_OPEN);

	/** 일어난 일을 알리고, 해야 할 일을 받는다 */
	const send = useCallback((event: OpenEvent): OpeningEffect => {
		const { opening: next, effect } = step(opening.current, event);
		opening.current = next;
		return effect;
	}, []);

	/**
	 * 본문과 색인을 함께 저장한다. 어느 원고에 쓸지는 인자로 받는다.
	 *
	 * 제목·목표·분량이 색인에도 있어서 저장이 두 키를 건드린다. 목록을 그릴 때
	 * 문서를 열지 않아도 되도록 치른 값이다. 같은 디바운스로 묶어 한 번에 쓴다.
	 *
	 * 본문은 색인에 넣지 않는다. 목록을 그릴 때 본문이 딸려 오면 원고 수만큼
	 * 무거워진다.
	 */
	const save = useCallback(
		(id: string, patch: Patch) => {
			if (!id) return;
			const { content, blocks: counted, ...entry } = patch;

			/*
			 * 둘 다 서버로 간다. 전에는 색인이 localStorage라 동기로 끝나서 탭이
			 * 닫히는 중에도 제목만은 남았는데, 이제 그런 자리는 없다 — 대신 본문은
			 * 보내기 전에 대기열에 한 벌 남으므로 잃지 않는다.
			 */
			const stats = counted ? layoutBlocks(counted).stats : undefined;
			const indexed = change({
				kind: "updateDoc",
				id,
				patch: {
					...entry,
					...(stats && { chars: stats.chars, sheets: stats.sheets }),
				},
			});

			if (content === undefined) return;

			/*
			 * 캐시도 함께 고친다. 이 원고를 떠났다가 돌아오면 캐시에서 읽는데,
			 * 갱신하지 않으면 방금 쓴 것이 옛것으로 되돌아간 것처럼 보인다.
			 */
			queryClient.setQueryData(docQueryKey(id), content);

			/*
			 * **잔디가 심기는 유일한 자리다.** 사람이 지금 이 원고를 고쳤다 —
			 * 다른 저장 경로(만들기·비우기·옛 원고 올리기)는 전부 `null`을 준다.
			 */
			const written = writeDoc(id, content, Date.now());
			/*
			 * 색인 쪽 실패는 `change`가 스스로 알린다. 본문 실패만 여기서 얹되
			 * 둘을 기다렸다가 알린다 — 먼저 끝난 쪽이 나중 것을 지우면 배너가
			 * 깜빡이다 사라진다.
			 */
			Promise.all([indexed, written]).then(([, body]) => {
				if (!body.ok) report(body);
			});
			return written;
		},
		[change, report, queryClient],
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

	/** 밀린 저장을 버린다. 되돌리거나 떠날 때다 */
	const discard = useCallback(() => {
		pending.current = null;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = undefined;
	}, []);

	/**
	 * 나중에 저장한다.
	 *
	 * 본문뿐 아니라 제목과 목표도 여기를 지난다. 전에는 그 둘이 곧바로 썼는데,
	 * 색인은 통째로 읽고 다시 굽는 것이라 제목 한 글자마다 원고 전체 목록을
	 * 다시 썼다.
	 */
	const queue = useCallback(
		(patch: Patch) => {
			const id = opening.current.meta;
			// 아직 아무 원고도 못 읽었으면 어디에 쓸지 모른다
			if (!id) return;

			pending.current = enqueue(pending.current, id, patch);

			window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(flush, DEBOUNCE);
		},
		[flush],
	);

	/**
	 * 주소에 있는 원고의 본문.
	 *
	 * 저장소가 서버라 기다려야 하는데, **늦게 온 본문이 남의 원고 위에 얹히는
	 * 문제는 여기서 다루지 않는다.** 캐시가 키(`docId`)별로 갈라져 있어 `stored`는
	 * 언제나 지금 `docId`의 것이다. 원고를 바꾸면 앞 원고의 읽기가 늦게 끝나도 그
	 * 결과는 앞 원고의 칸으로 들어간다.
	 *
	 * 전에는 이것을 ref로 손수 가렸는데, 그 가림막이 effect의 cleanup과 물려서
	 * 색인이 바뀔 때마다 진행 중인 읽기를 버리고 다시 읽지도 않는 상태가 됐다.
	 */
	const {
		data: stored,
		isPending: reading,
		isError: unreachable,
	} = useQuery({
		queryKey: docQueryKey(docId),
		queryFn: () => readDoc(docId),
		enabled: Boolean(docId),
	});

	/*
	 * 주소가 가리키는 원고로 갈아탄다. 사이드바에서 다른 원고를 고르면 다시 돈다.
	 *
	 * 저장 중인 것이 있으면 먼저 밀어 넣는다. 디바운스가 아직 안 터진 채로
	 * 원고를 바꾸면 마지막 몇 글자가 사라진다.
	 */
	useEffect(() => {
		const entry = index.docs.find((d) => d.id === docId);
		const effect = send({
			kind: "index",
			docId,
			pending: loadingIndex,
			listed: Boolean(entry),
		});

		if (effect.kind === "leave") {
			// 없는 원고를 가리키는 주소다. 밀린 저장을 버리고 열 수 있는 곳으로 보낸다
			discard();
			navigate({ to: "/", replace: true });
			return;
		}
		if (effect.kind !== "openMeta" || !entry) return;

		flush();
		setTitle(entry.title);
		setGoal(entry.goal);
		// 새 본문이 올 때까지 앞 원고를 그대로 두지 않는다
		if (effect.blank) setLoad({ state: "loading" });
	}, [docId, index, loadingIndex, navigate, send, flush, discard]);

	/*
	 * 본문이 도착하면 화면에 앉힌다.
	 *
	 * 위 effect와 나눈 이유는 시점이 다르기 때문이다. 제목과 목표는 색인에 있어
	 * 곧바로 알 수 있고, 본문은 기다려야 한다.
	 */
	useEffect(() => {
		const effect = send({
			kind: "body",
			docId,
			reading,
			unreachable,
			missing: stored == null,
		});

		if (effect.kind === "unreachable" || effect.kind === "lost") {
			docRef.current = null;
			setBlocks([]);
			setLoad({ state: effect.kind });
			return;
		}
		if (effect.kind !== "seatBody" || stored == null) return;

		const content = toEditorContent(stored);
		docRef.current = content;
		// 에디터를 기다리지 않고 바로 조판한다
		setBlocks(blocksFromDoc(content));
		setLoad({ state: "ready", content });
		setEditorKey((k) => k + 1);
	}, [docId, stored, reading, unreachable, send]);

	/*
	 * 목록에 적힌 분량이 실제와 다르면 고쳐 둔다.
	 *
	 * 휴지통에서 되살린 원고가 그렇고, 세는 법이 바뀌기 전에 적힌 값이 그렇다.
	 * 분량은 본문을 읽어야 나오는 값이라 목록만 보고는 알 수 없고, 아무도 다시
	 * 세지 않으면 영영 어긋난 채로 남는다.
	 */
	useEffect(() => {
		const entry = index.docs.find((d) => d.id === docId);
		const effect = send({
			kind: "typeset",
			docId,
			pending: loadingIndex,
			ready: load.state === "ready",
			listed: Boolean(entry),
		});
		if (effect.kind !== "recount" || !entry) return;

		const stats = layoutBlocks(blocks).stats;
		if (entry.chars === stats.chars && entry.sheets === stats.sheets) return;

		change({
			kind: "updateDoc",
			id: effect.docId,
			patch: { chars: stats.chars, sheets: stats.sheets },
			// 읽기만 했는데 목록에서 맨 위로 올라오면 "최근 수정순"이 거짓말이 된다
			touch: false,
		});
	}, [docId, index, loadingIndex, load.state, blocks, change, send]);

	/*
	 * 화면을 떠날 때 마지막 몇 글자를 지킨다.
	 *
	 * `pagehide`만으로는 모자라다. 탭이 닫히는 중에 건 쓰기는 끝나지 못하고 잘릴
	 * 수 있다. `visibilitychange`가 먼저 오고 더 자주 오므로 그쪽에서도 밀어
	 * 넣는다 — 다른 탭으로 옮기거나 앱을 배경으로 내리는 것이 전부 여기로 온다.
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

	/**
	 * 이 원고를 처음부터 다시 읽어 앉힌다.
	 *
	 * 밀린 저장을 **버린다.** 되돌린 뒤에 옛 글자가 밀려 들어가면 방금 되돌린
	 * 것을 도로 덮는다.
	 */
	const reload = useCallback(() => {
		discard();
		send({ kind: "reread" });
		queryClient.invalidateQueries({ queryKey: docQueryKey(docId) });
	}, [docId, queryClient, send, discard]);

	/** 화면을 갈아 끼운다. 저장은 부르는 쪽이 따로 시킨다 */
	const showContent = useCallback(
		(content: Content, next: Block[]) => {
			send({ kind: "showed" });
			docRef.current = content;
			setBlocks(next);
			setLoad({ state: "ready", content });
			setEditorKey((k) => k + 1);
		},
		[send],
	);

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
			if (resetId !== opening.current.meta) return;
			discard();

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
		[showContent, queryClient, discard],
	);

	return {
		load,
		blocks,
		title,
		goal,
		editorKey,
		clearToBlank,
		reload,
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

			// 앉힌 직후의 첫 알림은 우리가 넣어 준 그 내용이다. 저장할 것이 없다
			if (send({ kind: "editor" }).kind === "save") {
				queue({ content, blocks: next });
			}
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
