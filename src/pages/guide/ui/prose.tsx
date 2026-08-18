import { layoutBlocks, parseBlocks, WongojiSheet } from "#/entities/manuscript";

/**
 * 글 속에 쓰는 조각들.
 *
 * 사용법 글은 넷이고 짜임이 같다 — 절 제목, 문단, 표, 그리고 실제로 조판된 예.
 * 각 글이 제 클래스 문자열을 따로 적으면 넷이 조금씩 어긋난다.
 */

export function H2({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="mt-12 scroll-mt-20 border-border border-b pb-2 font-bold text-xl tracking-tight first:mt-0">
			{children}
		</h2>
	);
}

export function H3({ children }: { children: React.ReactNode }) {
	return <h3 className="mt-8 font-semibold text-base">{children}</h3>;
}

export function P({
	children,
	muted,
}: {
	children: React.ReactNode;
	/** 곁들이는 말. 본문보다 한 단계 물러나 보인다 */
	muted?: boolean;
}) {
	return (
		<p
			className={`mt-4 text-[0.95rem] leading-7 ${
				muted ? "text-muted-foreground" : ""
			}`}
		>
			{children}
		</p>
	);
}

export function UL({ children }: { children: React.ReactNode }) {
	return (
		<ul className="mt-4 space-y-2 text-[0.95rem] leading-7">{children}</ul>
	);
}

export function LI({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex gap-2.5">
			<span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-grid" />
			<span className="min-w-0">{children}</span>
		</li>
	);
}

/** 근거를 그대로 옮길 때. 이 글들의 값은 출처가 있다는 데 있다 */
export function Quote({
	children,
	cite,
	href,
}: {
	children: React.ReactNode;
	cite: string;
	href?: string;
}) {
	return (
		<figure className="mt-5 border-grid border-l-2 pl-4">
			<blockquote className="text-[0.95rem] text-muted-foreground leading-7">
				{children}
			</blockquote>
			<figcaption className="mt-2 text-muted-foreground text-xs">
				—{" "}
				{href ? (
					<a
						href={href}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-2 hover:text-foreground"
					>
						{cite}
					</a>
				) : (
					cite
				)}
			</figcaption>
		</figure>
	);
}

export function Table({
	head,
	rows,
}: {
	head: string[];
	rows: React.ReactNode[][];
}) {
	return (
		// 좁은 화면에서 표가 쪽을 밀지 않도록 제 안에서 넘긴다
		<div className="mt-5 overflow-x-auto">
			<table className="w-full min-w-md border-collapse text-[0.9rem]">
				<thead>
					<tr className="border-border border-b">
						{head.map((h) => (
							<th
								key={h}
								className="py-2 pr-4 text-left font-semibold text-muted-foreground text-xs"
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={String(row[0])}
							className="border-border/60 border-b last:border-0"
						>
							{row.map((cell, i) => (
								<td
									// biome-ignore lint/suspicious/noArrayIndexKey: 표의 칸은 열 위치가 곧 정체성이고 순서가 바뀌지 않는다
									key={i}
									className="py-2.5 pr-4 align-top leading-6"
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * 규칙이 실제로 어떻게 조판되는지 보인다.
 *
 * **글에 그림을 넣지 않고 엔진을 그대로 돌린다.** 원고지 사용법을 설명하는
 * 대부분의 글은 캡처 이미지를 쓰는데, 그러면 앱이 규칙을 고쳤을 때 글의 그림이
 * 조용히 거짓이 된다. 여기 보이는 칸은 원고를 쓸 때 돌아가는 것과 **같은
 * 함수**가 낸 결과라 어긋날 수가 없다.
 *
 * 순수 계산이라 서버에서도 돈다 — 첫 HTML에 격자가 실려 나가므로 크롤러도 이
 * 예를 본다.
 */
export function Example({
	text,
	caption,
}: {
	/** 조판해 보일 원문. 줄바꿈이 문단 구분이다 */
	text: string;
	caption: string;
}) {
	const { pages } = layoutBlocks(parseBlocks(text));
	const first = pages[0];
	if (!first) return null;

	/*
	 * 쓴 줄까지만 그린다. 엔진은 한 장을 늘 열 줄로 채워 돌려주는데, 두 줄짜리
	 * 예에 빈 줄 여덟이 붙으면 규칙 하나 보이는 데 화면 한 장이 든다.
	 */
	const used = first.lines.filter((line) => line.cells.length > 0).length;

	return (
		<figure className="mt-6">
			<div className="text-[0.75rem]">
				<WongojiSheet
					page={first}
					index={0}
					rows={Math.max(used, 1)}
					pageNumber={false}
				/>
			</div>
			<figcaption className="mt-2 text-muted-foreground text-xs leading-5">
				{caption}
			</figcaption>
		</figure>
	);
}
