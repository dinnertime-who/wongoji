import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";

/**
 * 이 앱이 따르는 규칙을 그대로 보여준다.
 *
 * 원고지 사용법에는 공인된 표준이 없다 — 국립국어원은 어문 규정 대상이 아니라고
 * 공식 답변한다. TOPIK 공식 자료가 유일하게 자기모순 없이 알고리즘화 가능한
 * 준(準)공식 문서라 이것을 기준으로 삼았다. 자세한 근거는 docs/wongoji-rules.md.
 */
const TOPIK_RULES = [
	"원고지 한 칸에 한 자씩 쓴다.",
	"글을 처음 시작할 때와 문단이 바뀔 때는 그 줄의 첫 칸을 비우고 둘째 칸부터 쓴다.",
	"한 문단 내에서는 처음 시작을 제외하고는 첫 칸을 비우지 않는다. 줄의 끝에서 비울 칸이 없는 경우 띄어 쓰지 않고 다음 줄 첫 칸부터 쓴다.",
	"아라비아 숫자는 한 칸에 두 자씩 쓴다.",
	"문장 부호는 한 칸에 하나씩 표시하는 것을 원칙으로 한다. 단, 줄표(―), 줄임표(……)는 두 칸에 쓴다.",
	"물음표(?), 느낌표(!) 다음에는 한 칸을 비운다. 다만, 온점(.), 반점(,), 쌍점(:) 뒤에는 칸을 비우지 않아도 된다.",
	"글자가 마지막 칸을 차지하여 문장 부호를 찍을 칸이 없을 때는 문장부호를 끝 칸에 글자와 함께 넣는다.",
];

const TOPIK_PDF =
	"https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175447974_51977.pdf";

const NIKL_QNA =
	"https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&qna_seq=322356&pageIndex=1";

export function RulesDialog() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<button
					type="button"
					className="rounded text-[var(--muted)] text-xs underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--ink)]"
				>
					TOPIK 공식 규칙
				</button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>TOPIK 공식 원고지 사용법</DialogTitle>
					<DialogDescription>
						이 앱이 조판에 그대로 적용하는 7개 항입니다.
					</DialogDescription>
				</DialogHeader>

				<ol className="mt-2 space-y-2.5 text-sm leading-6">
					{TOPIK_RULES.map((rule, i) => (
						<li key={rule} className="flex gap-2.5">
							<span className="shrink-0 text-[var(--muted)] tabular-nums">
								{i + 1}.
							</span>
							<span>{rule}</span>
						</li>
					))}
				</ol>

				<div className="mt-4 space-y-2 border-[var(--hairline)] border-t pt-4 text-[var(--muted)] text-xs leading-5">
					<p className="text-[var(--ink)]">
						<strong className="font-medium">7개 항 밖의 규칙 하나</strong> —
						대화문은 따옴표가 끝날 때까지 모든 줄의 첫 칸을 비웁니다. TOPIK에는
						없지만 학교 글짓기 계열 자료가 일치해서 말하는 관행이고, 대화가 많은
						글에서는 이것 없이는 조판이 실제와 크게 달라져 넣었습니다. 여는
						따옴표로 시작하는 문단을 대화문으로 봅니다.
					</p>
					<p>
						원고지 사용법에는 공인된 표준이 없습니다. 국립국어원은 "어문 규정에
						규정되어 있지 않으므로 관행을 따르라"고 답변하고 있어, 자료마다
						규칙이 실제로 엇갈립니다. 그중 자기모순이 없어 그대로 구현할 수 있는
						TOPIK 자료를 기준으로 삼았습니다.
					</p>
					<p className="flex flex-wrap gap-x-3">
						<a
							href={TOPIK_PDF}
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-2 hover:text-[var(--ink)]"
						>
							TOPIK 원문 PDF
						</a>
						<a
							href={NIKL_QNA}
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-2 hover:text-[var(--ink)]"
						>
							국립국어원 답변
						</a>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
