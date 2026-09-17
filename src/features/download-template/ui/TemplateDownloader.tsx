import { useEffect, useRef, useState } from "react";
import {
	DEFAULT_TEMPLATE_OPTIONS,
	MAX_TEMPLATE_PAGES,
	readTemplateOptions,
	TEMPLATE_COLORS,
	TEMPLATE_FORMATS,
	type TemplateColor,
	type TemplateFormat,
	templatePdfUrl,
	WongojiTemplate,
} from "#/entities/manuscript";
import { useSessionUser } from "#/shared/api/session";
import { trackDownload } from "#/shared/lib/analytics";
import { Button } from "#/shared/ui/button";
import { Input } from "#/shared/ui/input";
import { buildTemplatePdf } from "../api/build-pdf";

type Progress = { kind: "pdf" | "png"; completed: number; packing: boolean };

export function TemplateDownloader() {
	const [format, setFormat] = useState<TemplateFormat>(
		DEFAULT_TEMPLATE_OPTIONS.format,
	);
	const [color, setColor] = useState<TemplateColor>(
		DEFAULT_TEMPLATE_OPTIONS.color,
	);
	const [pages, setPages] = useState("1");
	const [start, setStart] = useState("1");
	const [preview, setPreview] = useState(0);
	const [progress, setProgress] = useState<Progress | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const active = useRef<AbortController | null>(null);
	const signedIn = useSessionUser() !== null;
	useEffect(() => () => active.current?.abort(), []);

	const options = readTemplateOptions(
		new URLSearchParams({ format: String(format), color, pages, start }),
	);
	const count = Number(pages);
	const first = Number(start);
	const pagesError =
		!Number.isSafeInteger(count) || count < 1 || count > MAX_TEMPLATE_PAGES;
	const startError =
		!Number.isSafeInteger(first) ||
		first < 1 ||
		!Number.isSafeInteger(first + count - 1);
	const previewIndex = options ? Math.min(preview, options.pages - 1) : 0;
	const previewNumber = options ? options.start + previewIndex : 1;
	const busy = progress !== null;

	const download = async (kind: "pdf" | "png") => {
		if (!options || active.current) return;
		const controller = new AbortController();
		active.current = controller;
		setError(null);
		setMessage(null);
		setProgress({ kind, completed: 0, packing: false });
		const onProgress = (completed: number, packing = false) => {
			if (!controller.signal.aborted) setProgress({ kind, completed, packing });
		};
		try {
			const { buildTemplatePng, saveTemplate } = await import(
				"../api/build-png"
			);
			controller.signal.throwIfAborted();
			const result =
				kind === "pdf"
					? {
							blob: await buildTemplatePdf(
								options,
								onProgress,
								controller.signal,
							),
							extension: "pdf" as const,
						}
					: await buildTemplatePng(options, onProgress, controller.signal);
			controller.signal.throwIfAborted();
			saveTemplate(result.blob, options, result.extension);
			trackDownload(signedIn, result.extension, "template", {
				template_chars: options.format,
				template_color: options.color,
				page_count: options.pages,
			});
			setMessage("파일을 만들었습니다. 다운로드를 시작합니다.");
		} catch {
			if (controller.signal.aborted) setMessage("파일 생성을 취소했습니다.");
			else
				setError(
					"파일을 만들지 못했습니다. 페이지 수를 줄이거나 다시 시도해 주세요.",
				);
		} finally {
			active.current = null;
			setProgress(null);
		}
	};

	return (
		<section
			aria-label="원고지 양식 선택과 다운로드"
			className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16"
		>
			<div className="min-w-0">
				<h2 className="font-semibold text-lg">양식 선택</h2>
				<fieldset disabled={busy} className="mt-6 space-y-7">
					<legend className="sr-only">원고지 다운로드 설정</legend>
					<fieldset>
						<legend className="mb-3 font-medium text-sm">원고지 종류</legend>
						<div className="grid grid-cols-3 gap-2">
							{TEMPLATE_FORMATS.map((item) => (
								<label key={item.value} className="relative cursor-pointer">
									<input
										type="radio"
										name="template-format"
										value={item.value}
										checked={format === item.value}
										onChange={() => {
											setFormat(item.value);
											setMessage(null);
										}}
										className="peer sr-only"
									/>
									<span className="flex min-h-20 flex-col justify-center rounded-md border border-border bg-[var(--paper)] px-3 py-3 text-center transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
										<span className="font-semibold text-base tabular-nums">
											{item.value}자
										</span>
										<span className="mt-1 text-muted-foreground text-xs">
											{item.columns}칸 × {item.rows}줄
										</span>
									</span>
								</label>
							))}
						</div>
					</fieldset>
					<fieldset>
						<legend className="mb-3 font-medium text-sm">격자 색상</legend>
						<div className="flex gap-3">
							{TEMPLATE_COLORS.map((item) => (
								<label
									key={item.value}
									className="relative flex-1 cursor-pointer"
								>
									<input
										type="radio"
										name="template-color"
										value={item.value}
										checked={color === item.value}
										onChange={() => {
											setColor(item.value);
											setMessage(null);
										}}
										className="peer sr-only"
									/>
									<span className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-[var(--paper)] px-3 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
										<span
											aria-hidden="true"
											className="size-3 rounded-full"
											style={{ backgroundColor: item.hex }}
										/>
										{item.label}
									</span>
								</label>
							))}
						</div>
					</fieldset>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="template-pages"
								className="mb-2 block font-medium text-sm"
							>
								페이지 수
							</label>
							<Input
								id="template-pages"
								type="number"
								min={1}
								max={MAX_TEMPLATE_PAGES}
								step={1}
								inputMode="numeric"
								value={pages}
								onChange={(event) => {
									setPages(event.target.value);
									setMessage(null);
								}}
								aria-invalid={pagesError}
								aria-describedby="template-pages-help"
								className="h-11 bg-[var(--paper)] tabular-nums"
							/>
							<p
								id="template-pages-help"
								className={`mt-2 text-xs ${pagesError ? "text-destructive" : "text-muted-foreground"}`}
							>
								{pagesError
									? "1~100 사이의 정수를 입력하세요."
									: "최대 100페이지"}
							</p>
						</div>
						<div>
							<label
								htmlFor="template-start"
								className="mb-2 block font-medium text-sm"
							>
								시작 번호
							</label>
							<Input
								id="template-start"
								type="number"
								min={1}
								step={1}
								inputMode="numeric"
								value={start}
								onChange={(event) => {
									setStart(event.target.value);
									setMessage(null);
								}}
								aria-invalid={startError}
								aria-describedby="template-start-help"
								className="h-11 bg-[var(--paper)] tabular-nums"
							/>
							<p
								id="template-start-help"
								className={`mt-2 text-xs ${startError ? "text-destructive" : "text-muted-foreground"}`}
							>
								{startError
									? "사용 가능한 양의 정수를 입력하세요."
									: "오른쪽 상단의 No. 번호"}
							</p>
						</div>
					</div>
				</fieldset>
				<div className="mt-8 border-border border-t pt-5">
					<p className="text-muted-foreground text-sm">
						A4 세로 · 페이지당 원고지 한 장
					</p>
					<p className="mt-1 break-words font-medium text-sm tabular-nums">
						{options
							? `총 ${options.pages}페이지 · No. ${options.start}~${options.start + options.pages - 1}`
							: "페이지 수와 시작 번호를 확인해 주세요."}
					</p>
					<div className="mt-5 grid grid-cols-2 gap-3">
						<Button className="h-12" asChild>
							<a
								href={templatePdfUrl(options ?? DEFAULT_TEMPLATE_OPTIONS)}
								download
								aria-disabled={busy || !options}
								tabIndex={busy || !options ? -1 : 0}
								onClick={(event) => {
									if (busy || !options) {
										event.preventDefault();
										return;
									}
									if (
										event.metaKey ||
										event.ctrlKey ||
										event.shiftKey ||
										event.altKey
									)
										return;
									event.preventDefault();
									void download("pdf");
								}}
								className={
									busy || !options ? "pointer-events-none opacity-50" : ""
								}
							>
								PDF 다운로드
							</a>
						</Button>
						<Button
							variant="outline"
							className="h-12 bg-[var(--paper)]"
							disabled={busy || !options}
							onClick={() => void download("png")}
						>
							PNG{options && options.pages > 1 ? " 묶음" : ""} 다운로드
						</Button>
					</div>
					<p className="mt-3 text-muted-foreground text-xs leading-5">
						PDF는 인쇄용, PNG는 이미지 삽입용입니다. PNG를 여러 장 받으면 ZIP
						파일로 묶어 드립니다.
					</p>
					<noscript>
						<p className="mt-3 text-sm">
							기본 PDF는 바로 다운로드할 수 있습니다. 양식 설정과 PNG 다운로드는
							JavaScript를 켜 주세요.
						</p>
					</noscript>
				</div>
				{progress && (
					<output className="mt-5 block" aria-live="polite">
						<div className="flex items-center justify-between gap-2 text-xs">
							<span>
								{progress.packing
									? "ZIP 파일로 묶는 중…"
									: `${progress.kind === "pdf" ? "PDF" : "PNG"} 만드는 중… ${progress.completed}/${options?.pages}`}
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => active.current?.abort()}
							>
								취소
							</Button>
						</div>
						<progress
							value={progress.completed}
							max={options?.pages ?? 1}
							aria-label="파일 생성 진행률"
							className="mt-2 h-1.5 w-full accent-[var(--grid)]"
						/>
					</output>
				)}
				{error && (
					<p role="alert" className="mt-4 text-destructive text-sm">
						{error}
					</p>
				)}
				{message && (
					<output className="mt-4 block text-muted-foreground text-sm">
						{message}
					</output>
				)}
			</div>
			<figure className="min-w-0 rounded-lg border border-border bg-muted/50 p-4 sm:p-6">
				<div className="mb-4 flex items-center justify-between gap-2 text-xs">
					<span className="font-medium">미리보기</span>
					<span className="text-muted-foreground">A4 · 210 × 297mm</span>
				</div>
				<WongojiTemplate
					format={format}
					color={color}
					number={previewNumber}
					className="mx-auto block w-full max-w-[360px] rounded-sm border border-border shadow-sm"
				/>
				<figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
					<span className="text-muted-foreground">
						{format}자 원고지 · No. {previewNumber}
					</span>
					{options && options.pages > 1 && (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								disabled={previewIndex === 0}
								onClick={() => setPreview(previewIndex - 1)}
								aria-label="미리보기 이전 페이지"
							>
								이전
							</Button>
							<span>
								{previewIndex + 1} / {options.pages}
							</span>
							<Button
								variant="ghost"
								size="sm"
								disabled={previewIndex === options.pages - 1}
								onClick={() => setPreview(previewIndex + 1)}
								aria-label="미리보기 다음 페이지"
							>
								다음
							</Button>
						</div>
					)}
				</figcaption>
			</figure>
		</section>
	);
}
