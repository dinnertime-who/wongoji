import type { Content } from "@tiptap/react";
import { useRef, useState } from "react";
import { type Manuscript, parseImported } from "#/entities/manuscript";
import { Button } from "#/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/shared/ui/dialog";
import { exportDocx, exportText } from "../api/export-files";

/** 여러 줄짜리 항목이라 버튼 기본 높이를 풀고 왼쪽 정렬로 둔다 */
const ROW =
	"h-auto w-full items-start justify-start gap-3 bg-[var(--paper)] p-3 text-left whitespace-normal hover:border-[var(--grid)]";

export function ExportDialog({
	manuscript,
	content,
	onImport,
}: {
	manuscript: Manuscript;
	/**
	 * 에디터 문서 원본.
	 *
	 * 평문은 이것으로 적는다 — `manuscript.blocks`는 조판을 거치며 빈 문단이
	 * 버려진 뒤라, 사람이 엔터를 몇 번 쳤는지가 남아 있지 않다.
	 */
	content: Content | null;
	onImport: (next: Manuscript) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const runDocx = async () => {
		setBusy(true);
		setError(null);
		try {
			await exportDocx(manuscript);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Word 파일을 만들지 못했습니다.",
			);
		} finally {
			setBusy(false);
		}
	};

	const handleFile = async (file: File | undefined) => {
		if (!file) return;
		setError(null);
		try {
			onImport(parseImported(await file.text()));
		} catch {
			setError("파일을 읽지 못했습니다.");
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					파일
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>내보내기 · 불러오기</DialogTitle>
					<DialogDescription>
						원고 한 편을 파일로 내보내거나, 파일에서 불러옵니다.
					</DialogDescription>
				</DialogHeader>

				<div className="mt-2 space-y-2">
					<Button
						variant="outline"
						onClick={runDocx}
						disabled={busy}
						className={ROW}
					>
						<span aria-hidden className="text-base leading-none">
							📄
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm">
								Word (.docx){busy && " — 만드는 중…"}
							</span>
							<span className="block text-muted-foreground text-xs leading-5">
								제출용. 바탕체 11pt, 줄간격 160%, A4에 여백 20·15·30·30mm.
								공모전마다 서식이 다르니 요강을 확인하세요.
							</span>
						</span>
					</Button>

					<Button
						variant="outline"
						onClick={() => content && exportText(manuscript.title, content)}
						disabled={!content}
						className={ROW}
					>
						<span aria-hidden className="text-base leading-none">
							📝
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm">텍스트 (.txt)</span>
							<span className="block text-muted-foreground text-xs leading-5">
								쓴 그대로. 띄운 줄은 띄운 수만큼 남습니다.
							</span>
						</span>
					</Button>

					<Button
						variant="outline"
						onClick={() => fileInput.current?.click()}
						className={`${ROW} border-dashed`}
					>
						<span aria-hidden className="text-base leading-none">
							📂
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm">불러오기</span>
							<span className="block text-muted-foreground text-xs leading-5">
								.txt 또는 예전 백업 .json.{" "}
								<strong>지금 원고를 덮어씁니다.</strong>
							</span>
						</span>
					</Button>
					<input
						ref={fileInput}
						type="file"
						accept=".json,.txt,application/json,text/plain"
						className="hidden"
						onChange={(e) => {
							handleFile(e.target.files?.[0]);
							e.target.value = "";
						}}
					/>
				</div>

				{error && <p className="mt-3 text-destructive text-xs">{error}</p>}
			</DialogContent>
		</Dialog>
	);
}
