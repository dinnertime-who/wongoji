import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import {
	exportBackup,
	exportDocx,
	exportText,
	type Manuscript,
	parseImported,
} from "#/lib/export";
import { parseBlocks } from "#/lib/wongoji";

/** 여러 줄짜리 항목이라 버튼 기본 높이를 풀고 왼쪽 정렬로 둔다 */
const ROW =
	"h-auto w-full items-start justify-start gap-3 bg-[var(--paper)] p-3 text-left whitespace-normal hover:border-[var(--grid)]";

export function ExportDialog({
	manuscript,
	onImport,
}: {
	manuscript: Manuscript;
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
			onImport(parseImported(await file.text(), parseBlocks));
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
						원고는 이 브라우저에만 저장됩니다. 긴 글이라면 백업을 받아 두세요.
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
							<span className="block text-[var(--muted)] text-xs leading-5">
								제출용. 바탕체 11pt, 줄간격 160%, A4에 여백 20·15·30·30mm.
								공모전마다 서식이 다르니 요강을 확인하세요.
							</span>
						</span>
					</Button>

					<Button
						variant="outline"
						onClick={() => exportBackup(manuscript)}
						className={ROW}
					>
						<span aria-hidden className="text-base leading-none">
							💾
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm">백업 (.json)</span>
							<span className="block text-[var(--muted)] text-xs leading-5">
								제목과 빈 행까지 그대로 되살릴 수 있는 완전한 사본.
							</span>
						</span>
					</Button>

					<Button
						variant="outline"
						onClick={() => exportText(manuscript)}
						className={ROW}
					>
						<span aria-hidden className="text-base leading-none">
							📝
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm">텍스트 (.txt)</span>
							<span className="block text-[var(--muted)] text-xs leading-5">
								어디서나 열리는 평문. 빈 행 표시는 남지 않습니다.
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
							<span className="block text-[var(--muted)] text-xs leading-5">
								.json 또는 .txt. <strong>지금 원고를 덮어씁니다.</strong>
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

				{error && (
					<p className="mt-3 text-[var(--destructive,#b3261e)] text-xs">
						{error}
					</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
