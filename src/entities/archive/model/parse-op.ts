import { isDocStatus } from "../config/status";
import type { ArchiveOp, DocPatch } from "./ops";

/**
 * 브라우저가 보낸 것이 연산인지 본다. **여기가 보관함의 유일한 관문이다.**
 *
 * 평소의 고치기가 전부 `POST /api/archive/ops`로 오므로, 이것을 지나 `applyOp`에
 * 닿는 값은 무엇이든 색인을 다시 쓴다. 믿을 수 없는 JSON과 순수 함수 사이에
 * 놓인 것이 이 파일 하나다.
 *
 * **깊이 뜯어보지는 않는다.** 없는 id를 가리키는 연산은 `applyOp`가 색인을 그대로
 * 돌려주므로 해로울 것이 없다. 여기서 막는 것은 두 가지다 —
 *
 * 1. **모양이 틀려서 순수 함수가 도중에 터지는 것.** 그러면 절반만 쓰인 채로 끝난다
 * 2. **고쳐서는 안 되는 칸이 패치에 섞여 드는 것**(`path`·`order`). 자리를 옮기는
 *    길은 `placeEntry` 하나여야 한다
 *
 * 라우트에서 떼어 놓은 이유는 그쪽이 D1과 `cloudflare:workers`를 물고 있어
 * 손에 쥘 수 없기 때문이다. 관문을 눈으로만 검사할 수는 없다 — `operations.ts`를
 * 저장소로부터 떼어 놓은 것과 같은 이유다.
 */

const isText = (v: unknown): v is string => typeof v === "string";

export function parseOp(body: unknown): ArchiveOp | null {
	if (!body || typeof body !== "object") return null;

	const op = body as Record<string, unknown>;
	switch (op.kind) {
		case "createDoc":
			return isText(op.path) && (op.title === undefined || isText(op.title))
				? { kind: "createDoc", path: op.path, title: op.title }
				: null;

		case "createFolder":
			return isText(op.name) && isText(op.path)
				? { kind: "createFolder", name: op.name, path: op.path }
				: null;

		case "duplicateDoc":
			return isText(op.id) ? { kind: "duplicateDoc", id: op.id } : null;

		case "updateDoc": {
			const patch = parsePatch(op.patch);
			/*
			 * `touch`는 없는 것이 기본 참이다. 목록에서 맨 위로 올리지 않는 저장은
			 * 분량 다시 세기뿐이고, 그쪽만 거짓을 실어 보낸다.
			 */
			return isText(op.id) && patch
				? { kind: "updateDoc", id: op.id, patch, touch: op.touch !== false }
				: null;
		}

		case "renameFolder":
			return isText(op.id) && isText(op.name)
				? { kind: "renameFolder", id: op.id, name: op.name }
				: null;

		case "placeEntry":
			return isMoving(op.moving) && isPlacement(op.to)
				? { kind: "placeEntry", moving: op.moving, to: op.to }
				: null;

		case "nudgeEntry":
			return isMoving(op.moving) && (op.dir === -1 || op.dir === 1)
				? { kind: "nudgeEntry", moving: op.moving, dir: op.dir }
				: null;

		case "trashDoc":
			return isText(op.id) ? { kind: "trashDoc", id: op.id } : null;

		case "trashFolder":
			return isText(op.id) ? { kind: "trashFolder", id: op.id } : null;

		case "restore":
			return isText(op.id) ? { kind: "restore", id: op.id } : null;

		case "purge":
			return Array.isArray(op.ids) && op.ids.every(isText)
				? { kind: "purge", ids: op.ids }
				: null;

		case "purgeAll":
			return { kind: "purgeAll" };

		default:
			return null;
	}
}

/**
 * 고칠 수 있는 값만 골라 담는다.
 *
 * **받은 것을 그대로 넘기지 않는다.** `updateDoc`은 패치를 원고 줄에 펼쳐
 * 얹으므로, 걸러내지 않으면 남이 보낸 `path`나 `order`가 그대로 들어가 원고가
 * 엉뚱한 폴더로 간다.
 */
function parsePatch(v: unknown): DocPatch | null {
	if (!v || typeof v !== "object") return null;
	const raw = v as Record<string, unknown>;
	const patch: DocPatch = {};

	if (raw.title !== undefined) {
		if (!isText(raw.title)) return null;
		patch.title = raw.title;
	}
	/*
	 * 상태는 정해 둔 셋 중 하나뿐이다. 아무 문자열이나 들어오면 화면이 모르는
	 * 뱃지가 목록에 뜬다. `null`도 받지 않는다 — 비어 있는 것은 초고로 읽으므로
	 * 그것을 적어 넣는 일은 상태를 초고로 되돌리는 일과 같고, 길이 둘이면 어느
	 * 쪽으로 왔느냐에 따라 `statusAt`이 달라진다.
	 */
	if (raw.status !== undefined) {
		if (!isDocStatus(raw.status)) return null;
		patch.status = raw.status;
	}
	for (const key of ["goal", "chars", "sheets"] as const) {
		if (raw[key] === undefined) continue;
		const n = raw[key];
		if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
		patch[key] = n;
	}
	return patch;
}

function isMoving(v: unknown): v is { kind: "doc" | "folder"; id: string } {
	if (!v || typeof v !== "object") return false;
	const m = v as Record<string, unknown>;
	return (m.kind === "doc" || m.kind === "folder") && isText(m.id);
}

function isPlacement(v: unknown): v is { path: string; before: string | null } {
	if (!v || typeof v !== "object") return false;
	const p = v as Record<string, unknown>;
	return isText(p.path) && (p.before === null || isText(p.before));
}
