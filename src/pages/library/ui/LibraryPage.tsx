import { Link, useNavigate } from "@tanstack/react-router";
import { FilePlusIcon, FileTextIcon } from "lucide-react";
import {
	DOC_STATUSES,
	type DocEntry,
	type DocStatus,
	displayTitle,
	ROOT,
	STATUS_LABEL,
	StatusIcon,
	statusOf,
	useArchive,
	useSaveStatus,
} from "#/entities/archive";
import { GrassGrid, tally, useWritingLog } from "#/entities/writing-log";
import { useCreateEntry } from "#/features/create-entry";
import { Button } from "#/shared/ui/button";
import { Skeleton } from "#/shared/ui/skeleton";
import { PageHeader } from "#/widgets/page-header";

/**
 * 서재 — 얼마나 써 왔는지 한 번에 보는 쪽.
 *
 * **로그인한 사람이 처음 닿는 쪽이다.** `/`에 들어오면 서버가 302로 여기 보낸다
 * (`routes/index.tsx`). 그래서 이 쪽은 보기만 하는 곳일 수 없다 — 글을 쓰러 온
 * 사람이 여기서 곧바로 시작할 수 있어야 해서 `새 원고`가 붙어 있고, 이어 쓰던
 * 것은 아래 목록 맨 앞에 있다.
 *
 * 주소는 `/`가 아니라 `/library`다. 서버가 302를 던지는 짜임(`pickEntry`)을 그대로
 * 두려는 것이다 — 그 302가 SSR에서 진짜 302라, 브라우저는 `/`의 JS를 받지도 않고
 * 여기로 온다.
 *
 * 여기 그리는 것 중 서버에 새로 묻는 것은 잔디 하나뿐이다. 최근 원고도 상태별
 * 수도 이미 받아 둔 색인에서 세면 나온다 — 목록을 그리려고 원고를 열지 않아도
 * 되게 색인에 제목·분량·상태를 함께 둔 값을 여기서 돌려받는다.
 */
export function LibraryPage() {
	const { index, isPending: loadingIndex } = useArchive();
	const { data, isPending: loadingLog } = useWritingLog();

	return (
		<>
			<PageHeader width="narrow">
				<span className="font-medium text-sm">서재</span>
			</PageHeader>

			{/*
			 * 쪽 전체의 세로 스크롤은 **ScrollArea로 감싸지 않는다.**
			 *
			 * Radix가 스크롤 칸 안쪽을 `display: table; min-width: 100%`인 겹으로
			 * 한 번 더 감싸는데, 그것은 내용에 맞춰 **늘어난다.** 그러면 여기 걸어
			 * 둔 `max-w-3xl`이 풀려서, 안에 든 것 중 제일 넓은 것(잔디 격자 686px)이
			 * 쪽 전체의 폭을 정한다 — 좁은 화면에서 격자만 밀려야 할 것이 쪽 전체가
			 * 가로로 밀린다. 실제로 그래서 잔디가 제 안에서 스크롤되지 않았다.
			 *
			 * 폴더 쪽·원고 쪽도 여기서는 그냥 `overflow-auto`를 쓴다. ScrollArea가
			 * 값을 하는 자리는 잔디 격자처럼 **칸이 정해진 채 안이 넘치는 곳**이고,
			 * 거기서는 쓴다(`GrassGrid`).
			 */}
			<div className="mx-auto w-full max-w-3xl overflow-auto px-6 py-10">
				<section aria-labelledby="잔디">
					<h1 id="잔디" className="font-heading text-2xl">
						써 온 날들
					</h1>

					{loadingLog || !data ? (
						<Skeleton className="mt-6 h-32 w-full" />
					) : (
						<>
							<Tally today={data.today} log={data.log} />
							<div className="mt-6">
								<GrassGrid today={data.today} log={data.log} />
							</div>
						</>
					)}
				</section>

				<section aria-labelledby="이어쓰기" className="mt-12">
					<div className="flex items-center justify-between gap-4">
						<h2 id="이어쓰기" className="font-heading text-lg">
							이어 쓰기
						</h2>
						{/*
						 * **서재가 착륙지가 되면서 필요해졌다.** 로그인한 사람이
						 * 처음 닿는 쪽인데 여기서 글을 시작할 길이 없으면, 새 원고를
						 * 만들려고 보관함을 열어야 한다 — 좁은 화면에서는 그것이
						 * 서랍이라 한 겹 더 깊다.
						 */}
						<NewDoc />
					</div>
					<Recent docs={index.docs} isPending={loadingIndex} />
				</section>

				<section aria-labelledby="상태" className="mt-12">
					<h2 id="상태" className="font-heading text-lg">
						어디까지 왔나
					</h2>
					<Progress docs={index.docs} />
				</section>
			</div>
		</>
	);
}

/**
 * 잔디에서 뽑은 숫자 셋.
 *
 * **이번 달이 음수일 수 있다.** 감추지 않는다 — 한 달 내내 덜어낸 사람에게
 * 0이라고 말하면 그 달에 한 일이 없어진다.
 */
function Tally({
	today,
	log,
}: {
	today: string;
	log: Parameters<typeof tally>[1];
}) {
	const { streak, best, thisMonth, days } = tally(today, log);

	if (days === 0) {
		return (
			<p className="mt-3 text-muted-foreground text-sm">
				아직 기록이 없습니다. 오늘 쓴 글자가 첫 칸에 남습니다.
			</p>
		);
	}

	return (
		<dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
			<Stat label="이어 쓴 날" value={`${streak}일`} />
			<Stat
				label={thisMonth < 0 ? "이번 달 덜어낸 분량" : "이번 달"}
				value={`${Math.abs(thisMonth).toLocaleString()}자`}
			/>
			<Stat label="가장 길게" value={`${best}일`} />
		</dl>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-0.5 font-heading text-2xl tabular-nums">{value}</dd>
		</div>
	);
}

/**
 * 새 원고를 맨 위에 만들고 곧바로 연다.
 *
 * 자리를 고르게 하지 않는다. 폴더 쪽(`FolderPage`)은 "이 폴더 안"이라는 자리가
 * 이미 정해져 있지만 서재에는 그런 자리가 없고, 여기서 자리를 묻기 시작하면
 * 글을 쓰러 온 사람이 폴더 고르는 창을 먼저 만난다. 옮기는 일은 보관함이 한다.
 */
function NewDoc() {
	const navigate = useNavigate();
	const { report } = useSaveStatus();
	const { createDocIn } = useCreateEntry();

	const 만든다 = async () => {
		const { docId, result } = await createDocIn(ROOT);
		report(result);
		// 못 만들었으면 옮기지 않는다. 없는 원고로 보내면 곧바로 되돌아온다
		if (docId) navigate({ to: "/w/$docId", params: { docId } });
	};

	return (
		<Button variant="outline" size="sm" onClick={만든다}>
			<FilePlusIcon />새 원고
		</Button>
	);
}

/** 최근 고친 순으로 몇 편. 색인의 `updatedAt`이 그대로 답한다 */
function Recent({ docs, isPending }: { docs: DocEntry[]; isPending: boolean }) {
	if (isPending) {
		return <Skeleton className="mt-4 h-24 w-full" />;
	}

	const recent = [...docs]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, 6);

	if (recent.length === 0) {
		return (
			<p className="mt-3 text-muted-foreground text-sm">
				아직 원고가 없습니다.
			</p>
		);
	}

	return (
		<ul className="mt-4 grid gap-2 sm:grid-cols-2">
			{recent.map((doc) => (
				<li key={doc.id}>
					<Link
						to="/w/$docId"
						params={{ docId: doc.id }}
						className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm hover:bg-muted"
					>
						<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{displayTitle(doc)}</span>
						<StatusIcon
							status={statusOf(doc.status)}
							className="ml-auto size-4"
						/>
						<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
							{doc.sheets}매
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

/**
 * 상태별로 몇 편인가.
 *
 * 눌러서 걸러 보는 자리는 두지 않았다. 거를 곳이 있으려면 상태별 목록 쪽이
 * 하나 더 있어야 하는데, 그것은 보관함이 이미 하는 일이다 — 여기서는 세는
 * 것까지가 몫이다.
 */
function Progress({ docs }: { docs: DocEntry[] }) {
	const counted = DOC_STATUSES.map((status) => ({
		status,
		n: docs.filter((d) => statusOf(d.status) === status).length,
	}));
	const total = docs.length;

	if (total === 0) return null;

	return (
		<dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
			{counted.map(({ status, n }) => (
				<div key={status}>
					<dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<StatusIcon status={status as DocStatus} className="size-3.5" />
						{STATUS_LABEL[status]}
					</dt>
					<dd className="mt-0.5 font-heading text-2xl tabular-nums">{n}편</dd>
				</div>
			))}
		</dl>
	);
}
