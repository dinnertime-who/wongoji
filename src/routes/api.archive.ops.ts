import { createFileRoute } from "@tanstack/react-router";
// createFileRoute의 `server` 옵션은 react-start가 declare module로 얹는다
import type {} from "@tanstack/react-start";
import type { ArchiveOp, DocPatch } from "#/entities/archive";
import { applyArchiveOp } from "#/server/archive";
import { db } from "#/server/db";
import { currentUserId, unauthorized } from "#/server/session";

/**
 * 보관함에 무엇을 했는지 알린다.
 *
 * 색인 전체를 밀어 넣는 길(`POST /api/archive`)과 나눠 둔 이유는, 그쪽으로는
 * **지운 것을 알릴 수가 없기 때문이다.** 빠진 것이 "지웠다"인지 "이 기기에는
 * 없다"인지 서버가 구별할 방법이 없어서, 완전히 지운 원고가 다음 새로고침에
 * 되살아났다.
 *
 * 돌려주는 것은 바뀐 뒤의 색인 전체다. 한 사람의 색인이 작아서(원고 200편에
 * 57KB) 델타를 설계할 값이 아니다.
 */
export const Route = createFileRoute("/api/archive/ops")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const userId = await currentUserId(request);
				if (!userId) return unauthorized();

				const op = await readOp(request);
				if (!op) {
					return Response.json(
						{ error: "연산 모양이 아닙니다" },
						{ status: 400 },
					);
				}

				return Response.json(await applyArchiveOp(db, userId, op));
			},
		},
	},
});

const isText = (v: unknown): v is string => typeof v === "string";

/**
 * 들어온 것이 연산인지 본다.
 *
 * 깊이 뜯어보지는 않는다 — 없는 id를 가리키는 연산은 `applyOp`가 색인을 그대로
 * 돌려주므로 해로울 것이 없다. 여기서 막는 것은 **모양이 틀려서 순수 함수가
 * 도중에 터지는 것**이다. 그러면 절반만 쓰인 채로 끝난다.
 */
async function readOp(request: Request): Promise<ArchiveOp | null> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return null;
	}
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
			const patch = readPatch(op.patch);
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
 * 엉뚱한 폴더로 간다. 자리를 옮기는 길은 `placeEntry` 하나여야 한다.
 */
function readPatch(v: unknown): DocPatch | null {
	if (!v || typeof v !== "object") return null;
	const raw = v as Record<string, unknown>;
	const patch: DocPatch = {};

	if (raw.title !== undefined) {
		if (!isText(raw.title)) return null;
		patch.title = raw.title;
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
