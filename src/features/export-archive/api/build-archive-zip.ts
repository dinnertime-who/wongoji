import type { Content } from "@tiptap/react";
import { docToFileText, readDoc, safeFileName } from "#/entities/manuscript";
import type { ZipEntry } from "../lib/tree";
import { download } from "./download";

/**
 * 보관함을 zip 하나로 묶는다.
 *
 * **브라우저에서 만든다.** 서버가 D1을 한 번에 읽어 zip까지 만들어 주면 왕복이
 * 하나로 줄지만, 그러면 **아직 보내지 못한 글이 빠진다.** `readDoc`은 미전송
 * 대기열(IndexedDB)을 먼저 보므로, 저장에 실패한 채 남아 있던 글도 이 길로는
 * 제대로 담긴다 — 백업을 받는 자리에서 그것을 잃으면 백업의 뜻이 없다.
 *
 * 원고 수만큼 요청이 나가지만 한 번에 몇 개씩만 보낸다. 전부 한꺼번에 던지면
 * 브라우저가 알아서 줄을 세우기는 해도, 실패했을 때 어디까지 됐는지 알기 어렵고
 * 서버에도 한꺼번에 몰린다.
 */

/** 한 번에 띄우는 요청 수. 브라우저가 같은 호스트에 여는 연결 수와 맞춘다 */
const LANES = 6;

export interface ArchiveZipProgress {
	done: number;
	total: number;
}

export interface ArchiveZipResult {
	blob: Blob;
	/** 본문을 읽지 못한 원고. 담기지 않았다는 뜻이다 */
	missed: string[];
}

/**
 * 받은 날을 파일 이름에 적는다. 여러 번 받아도 서로 덮지 않는다.
 *
 * 폴더 하나를 받을 때는 그 폴더 이름이 앞에 온다 — 같은 날 여러 폴더를 받는
 * 일이 잦고, 날짜만 적혀 있으면 받아 놓은 zip끼리 구별이 되지 않는다.
 */
export function archiveFileName(now: Date, name = "원고지-보관함"): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return `${name}-${stamp}.zip`;
}

/**
 * 원고 하나를 파일 하나로.
 *
 * 못 읽은 것은 **건너뛰지 않고 알린다.** 조용히 빠뜨리면 받아 간 사람은 그
 * 원고를 애초에 안 썼다고 여긴다.
 */
async function readEntry(
	entry: ZipEntry,
): Promise<{ entry: ZipEntry; text: string } | { entry: ZipEntry }> {
	try {
		const content = await readDoc(entry.docId);
		if (content == null) return { entry };
		return { entry, text: docToFileText(entry.title, content as Content) };
	} catch {
		// 서버에 닿지 못한 것과 없는 것을 여기서는 가르지 않는다. 둘 다 못 담았다
		return { entry };
	}
}

export async function buildArchiveZip(
	entries: ZipEntry[],
	onProgress?: (progress: ArchiveZipProgress) => void,
): Promise<ArchiveZipResult> {
	/*
	 * `jszip`은 `docx`가 이미 끌고 오는 것이라 잠금 파일이 늘지 않는다. 그래도
	 * 첫 짐에는 얹지 않는다 — 원고를 쓰는 데는 필요 없고, 받을 때만 있으면 된다.
	 */
	const { default: JSZip } = await import("jszip");
	const zip = new JSZip();

	const missed: string[] = [];
	let done = 0;
	let next = 0;

	const lane = async () => {
		while (next < entries.length) {
			const entry = entries[next++];
			if (!entry) break;
			const read = await readEntry(entry);
			if ("text" in read) {
				zip.file(read.entry.path, read.text);
			} else {
				missed.push(read.entry.title || read.entry.path);
			}
			done += 1;
			onProgress?.({ done, total: entries.length });
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(LANES, entries.length) }, lane),
	);

	const blob = await zip.generateAsync({
		type: "blob",
		compression: "DEFLATE",
		// 원고는 글자라 잘 줄어든다. 가장 센 단계를 써도 시간이 얼마 들지 않는다
		compressionOptions: { level: 9 },
	});

	return { blob, missed };
}

/** 만든 zip을 브라우저에 내려 준다 */
export function downloadZip(blob: Blob, filename: string) {
	download(blob, safeFileName(filename.replace(/\.zip$/, "")).concat(".zip"));
}
