import { Button } from "#/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/shared/ui/dialog";
import { NIKL_QNA, TOPIK_PDF, TOPIK_RULES } from "../config/rules";

export function RulesDialog() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="link"
					size="xs"
					className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
				>
					TOPIK 공식 규칙
				</Button>
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
							<span className="shrink-0 text-muted-foreground tabular-nums">
								{i + 1}.
							</span>
							<span>{rule}</span>
						</li>
					))}
				</ol>

				<div className="mt-4 space-y-2 border-border border-t pt-4 text-muted-foreground text-xs leading-5">
					<p className="text-foreground">
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
							className="underline underline-offset-2 hover:text-foreground"
						>
							TOPIK 원문 PDF
						</a>
						<a
							href={NIKL_QNA}
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-2 hover:text-foreground"
						>
							국립국어원 답변
						</a>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
