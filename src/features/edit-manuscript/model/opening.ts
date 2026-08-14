/**
 * 원고 하나를 여는 동안 어디까지 왔는가.
 *
 * **ref 넷이 답하던 것을 값 하나로 접었다.** 전에는 `openedRef`·`shownRef`·
 * `seatedRef`·`countedRef`가 저마다 "이 원고를 이미 …했나"를 들고 있었고, 그
 * 넷이 합쳐 만드는 국면은 훅을 처음부터 읽어야 보였다. 여는 일이 어긋나서 난
 * 버그가 여럿이었는데(옮긴 원고가 본문을 잃던 것, 로그인 직후 화면이 왕복하던 것)
 * 전부 "지금 어느 국면인가"를 잘못 읽어서였다.
 *
 * 여기 있는 것은 **순수 함수다.** React도 저장소도 주소도 모른다 — 무슨 일이
 * 있었는지(`OpenEvent`)를 받아 다음 자리와 해야 할 일(`Effect`)을 돌려줄 뿐이고,
 * 실제로 하는 것은 훅이 한다. 그래서 "원고를 바꾸는 도중에 옛 에디터가 알려 온
 * 내용"처럼 손으로 재현하기 어려운 순서를 테스트에서 그냥 적어 볼 수 있다.
 *
 * `operations.ts`가 색인에 대해 하는 일을 이 파일이 열기에 대해 한다.
 */

/** 여는 일이 어디까지 왔는가. 빈 문자열은 "아직 아무 원고도"라는 뜻이다 */
export interface Opening {
	/** 제목·목표를 앉힌 원고. 색인에 있는 값이라 본문보다 먼저 온다 */
	meta: string;
	/**
	 * 본문을 앉힌 원고.
	 *
	 * `meta`와 갈라 두는 이유는 시점이 다르기 때문이다. 제목은 색인에 있어 곧바로
	 * 알 수 있고 본문은 기다려야 한다. 하나로 묶으면 둘 중 늦은 쪽에 맞춰야 하고,
	 * 그동안 제목 칸이 앞 원고의 것을 들고 있게 된다.
	 */
	body: string;
	/**
	 * 다음에 올 에디터 알림은 사람이 친 것이 아니다.
	 *
	 * 에디터는 마운트될 때 조판하라고 한 번 알려 오는데(`WongojiEditor`), 그것은
	 * **방금 우리가 넣어 준 그 내용**이다. 그대로 저장 큐를 태우면 원고를 열기만
	 * 해도 본문이 서버로 한 번 써지고, 그 쓰기가 완성을 퇴고로 내린다.
	 */
	echo: boolean;
	/** 분량을 실제로 세어 목록과 맞춰 본 원고 */
	counted: string;
}

/** 아직 아무 원고도 열지 않았다 */
export const NOTHING_OPEN: Opening = {
	meta: "",
	body: "",
	echo: false,
	counted: "",
};

/** 여는 동안 밖에서 일어나는 일들 */
export type OpenEvent =
	/**
	 * 주소나 색인이 움직였다.
	 *
	 * 색인도 함께 보는 이유는, 보고 있던 원고가 다른 탭에서 사라지면 그 사실이
	 * 색인으로 오기 때문이다. 주소만 보고 있으면 없어진 원고에 계속 쓴다.
	 */
	| { kind: "index"; docId: string; pending: boolean; listed: boolean }
	/** 본문 질의가 답했다 */
	| {
			kind: "body";
			docId: string;
			reading: boolean;
			/** 본문이 있는 곳에 닿지 못했다 */
			unreachable: boolean;
			/** 닿았는데 없다 */
			missing: boolean;
	  }
	/** 조판이 끝났다. 목록에 적힌 분량과 맞는지 볼 수 있는 때다 */
	| {
			kind: "typeset";
			docId: string;
			pending: boolean;
			ready: boolean;
			listed: boolean;
	  }
	/** 에디터가 지금 내용을 알려 왔다 */
	| { kind: "editor" }
	/** 밖에서 화면을 통째로 갈아 끼웠다 — 불러오기·비우기·빈 원고로 시작 */
	| { kind: "showed" }
	/** 이 원고를 처음부터 다시 읽는다 */
	| { kind: "reread" };

/** 그 사건에 뒤따라 해야 할 일. 실제로 하는 것은 훅이 한다 */
export type Effect =
	| { kind: "nothing" }
	/** 없는 원고를 가리키는 주소다. 밀린 저장을 버리고 열 수 있는 곳으로 보낸다 */
	| { kind: "leave" }
	/**
	 * 제목·목표를 앉힌다. 밀린 저장을 먼저 밀어 넣는다.
	 *
	 * `blank`면 화면도 기다리는 자리로 되돌린다 — 이 원고의 본문을 아직 앉히지
	 * 않았다는 뜻이라, 그대로 두면 새 본문이 올 때까지 앞 원고가 남는다.
	 */
	| { kind: "openMeta"; docId: string; blank: boolean }
	/** 본문을 앉힌다 */
	| { kind: "seatBody"; docId: string }
	/** 목록에는 있는데 본문이 없다 */
	| { kind: "lost" }
	/** 본문이 있는 곳에 닿지 못했다 */
	| { kind: "unreachable" }
	/** 분량을 세어 목록과 다르면 고쳐 둔다 */
	| { kind: "recount"; docId: string }
	/** 사람이 친 것이다. 저장 큐에 태운다 */
	| { kind: "save" };

export interface Step {
	opening: Opening;
	effect: Effect;
}

const stay = (opening: Opening): Step => ({
	opening,
	effect: { kind: "nothing" },
});

export function step(now: Opening, event: OpenEvent): Step {
	switch (event.kind) {
		case "index":
			return onIndex(now, event);
		case "body":
			return onBody(now, event);
		case "typeset":
			return onTypeset(now, event);
		case "editor":
			/*
			 * 앉힌 직후의 첫 알림은 우리가 넣어 준 그 내용이다. 한 번만 삼킨다 —
			 * 그다음부터는 사람이 친 것이다.
			 */
			return now.echo
				? stay({ ...now, echo: false })
				: { opening: now, effect: { kind: "save" } };
		case "showed":
			/*
			 * 밖에서 갈아 끼운 것은 **삼키지 않는다.** 갈아 끼운 쪽이 저장을 따로
			 * 시키고, 뒤따라오는 마운트 알림은 같은 내용이라 큐에서 합쳐진다.
			 */
			return stay(now);
		case "reread":
			/*
			 * 둘 다 비워야 제목·목표와 본문이 함께 다시 앉는다.
			 *
			 * `counted`는 그대로 둔다. 다시 읽을 일은 이력에서 되돌렸을 때인데,
			 * 그때 목록의 분량은 서버가 그 버전의 값으로 이미 고쳐 두었다.
			 */
			return stay({ ...now, meta: "", body: "" });
	}
}

function onIndex(
	now: Opening,
	{
		docId,
		pending,
		listed,
	}: { docId: string; pending: boolean; listed: boolean },
): Step {
	/*
	 * 목록을 아직 못 받았으면 아무 판단도 하지 않는다.
	 *
	 * **없는 것과 아직 모르는 것은 다르다.** 뭉뚱그리면 새로고침할 때마다 멀쩡한
	 * 원고를 "없다"고 보고 홈으로 돌려보내고, 홈은 보관함이 비었다고 보고 원고를
	 * 새로 만든다.
	 */
	if (pending) return stay(now);
	/*
	 * 열어 둔 원고가 없다. 체험 모드(로그인 없이 쓰는 한 편)에서도 이 훅이
	 * 불리는데, 그때 여기서 "없는 원고"라고 판단하면 홈으로 돌려보낸다.
	 */
	if (!docId) return stay(now);

	if (!listed) {
		return { opening: { ...now, meta: "" }, effect: { kind: "leave" } };
	}

	/*
	 * 이미 열어 둔 원고면 다시 앉히지 않는다. 색인이 바뀔 때마다 되읽으면
	 * 타이핑 도중에 에디터가 통째로 갈린다.
	 */
	if (now.meta === docId) return stay(now);

	return {
		opening: { ...now, meta: docId },
		effect: { kind: "openMeta", docId, blank: now.body !== docId },
	};
}

function onBody(
	now: Opening,
	{
		docId,
		reading,
		unreachable,
		missing,
	}: {
		docId: string;
		reading: boolean;
		unreachable: boolean;
		missing: boolean;
	},
): Step {
	if (!docId || reading) return stay(now);
	// 이 원고는 이미 앉혔다. 다시 하면 타이핑 도중에 에디터가 갈린다
	if (now.body === docId) return stay(now);

	/*
	 * 못 읽었다. **"없다"고 말하지 않는다** — 그 화면에는 "빈 원고로 시작"이
	 * 있고, 연결이 끊겼을 뿐인데 그것을 누르면 멀쩡한 원고를 덮는다.
	 */
	if (unreachable) return { opening: now, effect: { kind: "unreachable" } };

	/*
	 * 본문이 사라졌다. 빈 에디터를 띄우면 그대로 저장되어 마지막 흔적까지 덮어쓴다.
	 *
	 * **여기서는 앉혔다고 표시하지 않는다.** 동기화가 다른 기기에서 쓴 본문을
	 * 뒤늦게 받아 올 수 있는데, 표시해 두면 그것이 도착해도 화면은 "찾을 수
	 * 없습니다"에 머문다. 표시하지 않으면 본문이 바뀔 때 다시 돌아 앉힌다.
	 */
	if (missing) return { opening: now, effect: { kind: "lost" } };

	return {
		opening: { ...now, body: docId, echo: true },
		effect: { kind: "seatBody", docId },
	};
}

function onTypeset(
	now: Opening,
	{
		docId,
		pending,
		ready,
		listed,
	}: { docId: string; pending: boolean; ready: boolean; listed: boolean },
): Step {
	/*
	 * **본문과 목록이 둘 다 도착한 뒤에 본다.** 앉히는 자리에서 보던 것을 떼어
	 * 냈다 — 거기서는 본문이 목록보다 먼저 오는 새로고침에서 "목록에 없는 원고"로
	 * 보고 그냥 지나갔고, 목록이 도착해도 다시 볼 길이 없었다.
	 */
	if (pending || !ready || !listed) return stay(now);
	/*
	 * 원고마다 한 번만 본다. 타이핑 중에도 오는 사건이라, 표시해 두지 않으면
	 * 글자 하나마다 서버로 간다 — 300ms 디바운스가 있는 이유가 없어진다.
	 */
	if (now.counted === docId) return stay(now);

	return {
		opening: { ...now, counted: docId },
		effect: { kind: "recount", docId },
	};
}
