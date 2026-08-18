import { Link } from "@tanstack/react-router";
import { NIKL_QNA, TOPIK_PDF, TOPIK_RULES } from "#/entities/manuscript";
import { SOURCES } from "#/shared/config/guide";
import { Example, H2, H3, LI, P, Quote, Table, UL } from "./prose";

/**
 * 원고지 쓰는 법 — 기본.
 *
 * 이 글이 먼저 하는 일은 규칙을 늘어놓는 것이 아니라 **기준이 없다는 사실을
 * 밝히는 것**이다. 원고지 사용법을 다루는 글은 대개 저마다의 관행을 유일한
 * 정답처럼 적는데, 국립국어원이 표준이 없다고 답한 자리라 그것부터 짚지 않으면
 * 뒤의 규칙이 어디서 왔는지 알 수 없다.
 */
export function RulesArticle() {
	return (
		<>
			<H2>원고지에는 정해진 표준이 없습니다</H2>
			<P>
				먼저 알아 두어야 할 것이 있습니다. 원고지 사용법은 어문 규정의 대상이
				아닙니다. 국립국어원은 이렇게 답합니다.
			</P>
			<Quote cite="국립국어원 온라인가나다" href={NIKL_QNA}>
				원고지 사용법에 관해서는 어문 규정에 규정되어 있지 않으므로 관행을
				따르거나 관련 서적을 참고하시길 바랍니다.
			</Quote>
			<P>
				그래서 참고서마다, 가르치는 사람마다 설명이 조금씩 다릅니다. 아래에서
				“자료마다 갈린다”고 적은 대목은 조사가 모자라서가 아니라 실제로 그렇기
				때문입니다.
			</P>
			<P>
				이 글은 <strong className="font-semibold">TOPIK 공식 자료</strong>를
				기준으로 삼습니다. 준(準)공식 문서 가운데 자기모순이 없어 그대로
				규칙으로 옮길 수 있는 유일한 것이고, 원고지도 이것을 조판 기준으로
				씁니다.
			</P>

			<H2>200자 원고지는 20칸 × 10줄입니다</H2>
			<P>
				한 줄에 20칸, 그런 줄이 10개. 곱하면 200칸이라 “200자 원고지”입니다.
				여기서 한 칸은 글자 하나가 아니라 <em>자리</em> 하나입니다 — 띄어쓰기도
				한 칸을 차지하고, 문장부호도 한 칸을 차지합니다.
			</P>
			<Table
				head={["규격", "배치", "쓰이는 곳"]}
				rows={[
					[
						<strong key="a" className="font-semibold">
							200자
						</strong>,
						"20칸 × 10줄",
						"기본. 공모전 분량은 거의 이 단위로 적힙니다",
					],
					["400자", "20칸 × 20줄", "긴 원고"],
					["150자", "15칸 × 10줄", "신문사용"],
				]}
			/>
			<Quote cite="위키백과 「원고지」" href={SOURCES.wikipedia}>
				별도의 지정이 없는 한 200자 원고지를 사용하는 게 보통이며, 그것이 한
				단위가 되고 있다.
			</Quote>

			<H2>TOPIK 공식 7개 항</H2>
			<P>
				원고지가 조판에 그대로 적용하는 규칙입니다. 아래 글들은 이 일곱 항을
				경우별로 풀어 놓은 것입니다.
			</P>
			<ol className="mt-5 space-y-3 text-[0.95rem] leading-7">
				{TOPIK_RULES.map((rule, i) => (
					<li key={rule} className="flex gap-3">
						<span className="shrink-0 text-muted-foreground tabular-nums">
							{i + 1}.
						</span>
						<span className="min-w-0">{rule}</span>
					</li>
				))}
			</ol>
			<p className="mt-4 text-muted-foreground text-xs">
				<a
					href={TOPIK_PDF}
					target="_blank"
					rel="noreferrer"
					className="underline underline-offset-2 hover:text-foreground"
				>
					TOPIK 공식 〈원고지 사용법〉 원문 PDF
				</a>
			</p>

			<H2>문단은 첫 칸을 비우고 둘째 칸부터</H2>
			<P>
				글을 처음 시작할 때와 문단이 바뀔 때는 그 줄의 첫 칸을 비웁니다. 이것은
				모든 자료가 일치하는, 예외가 없는 규칙입니다.
			</P>
			<P>
				반대로{" "}
				<strong className="font-semibold">
					한 문단 안에서 줄이 넘어갈 때는 첫 칸을 비우지 않습니다.
				</strong>{" "}
				비우면 문단이 새로 시작한 것처럼 보이기 때문입니다.
			</P>
			<Example
				text={
					"봄이 왔다. 뜰의 매화가 먼저 피었다.\n어머니는 그것을 오래 바라보셨다."
				}
				caption="문단 둘. 각 문단의 첫 줄만 첫 칸이 비어 있습니다. 첫째 줄 마지막 칸을 보면 ‘다’와 마침표가 한 칸에 함께 들어가 있는데, 부호를 찍을 칸이 없을 때의 처리입니다(7항)."
			/>

			<H2>한 칸에 몇 자가 들어가나</H2>
			<P>
				한글은 한 칸에 한 자입니다. 그런데 숫자와 알파벳 소문자는 두 자씩
				들어갑니다. 세로로 긴 한글 한 칸에 가로로 좁은 글자를 하나만 넣으면 빈
				자리가 너무 커 보이기 때문입니다.
			</P>
			<Table
				head={["대상", "한 칸에", "예"]}
				rows={[
					["한글 · 한자", "1자", "글"],
					["알파벳 대문자", "1자", "K"],
					[
						"알파벳 소문자",
						<strong key="b" className="font-semibold">
							2자
						</strong>,
						"or",
					],
					[
						"아라비아 숫자",
						<strong key="c" className="font-semibold">
							2자
						</strong>,
						"19",
					],
					["로마 숫자", "1자", "Ⅲ"],
				]}
			/>
			<P>
				여러 자가 이어질 때는{" "}
				<strong className="font-semibold">앞에서부터 두 자씩</strong> 끊습니다.
				홀수면 마지막 한 자가 혼자 한 칸을 씁니다.
				<code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-[0.85em]">
					Korea
				</code>
				는 대문자 K가 한 칸, 그다음 or과 ea가 각각 한 칸씩 — 모두 세 칸입니다.
			</P>
			<Example
				text="1945년 8월 15일, Korea는 광복을 맞았다."
				caption="1945는 19와 45로 나뉘어 두 칸, 15는 한 칸, 8은 뒤에 이어지는 숫자가 없어 혼자 한 칸. Korea는 K / or / ea로 세 칸입니다."
			/>
			<P muted>
				한 자리 숫자를 어떻게 둘지는 자료마다 갈립니다. TOPIK 4항은 예외를 두지
				않아 늘 두 자씩 묶으라고 하고, 학교 글짓기 계열 자료는 한 자리 숫자에 한
				칸을 줍니다.
			</P>

			<H2>첫 장에 제목과 이름을 놓는 자리</H2>
			<P>
				여기가 자료 간 차이가 가장 큰 대목입니다. 공통된 골자만 추리면
				이렇습니다.
			</P>
			<Table
				head={["줄", "내용"]}
				rows={[
					["1", "비움"],
					["2", "제목 — 줄 가운데에 오도록"],
					["3", "비움"],
					["4", "소속 — 오른쪽으로 붙이고 끝에서 두어 칸 비움"],
					["5", "이름 — 같은 방식"],
					["6", "비움"],
					["7", "본문 시작 (첫 칸 비우고 둘째 칸부터)"],
				]}
			/>
			<UL>
				<LI>제목에는 문장부호를 쓰지 않습니다.</LI>
				<LI>
					제목이 20칸을 넘으면 두 줄로 나누되 첫 줄은 왼쪽, 둘째 줄은 오른쪽으로
					붙입니다.
				</LI>
				<LI>
					성과 이름은 붙여 씁니다. 다만 남궁·선우처럼 두 자 성은 띄웁니다.
				</LI>
				<LI>부제목은 양끝에 줄표를 붙여 본제목 아랫줄 가운데에 둡니다.</LI>
			</UL>
			<P muted>
				줄 수는 자료마다 다릅니다. 백과사전 계열은 더 압축해서 2줄에 제목,
				3~4줄에 이름, 그 뒤 한 줄 비우고 본문을 시작하라고 합니다. 응모 요강에
				양식이 지정돼 있으면 그쪽이 우선입니다.
			</P>

			<H3>온라인 접수라면 이 배치는 대개 필요 없습니다</H3>
			<P>
				요즘 공모전은 한글(HWP)이나 워드 파일로 받고, 신춘문예 다수는 A4 출력을
				우편으로 받습니다. 원고지 격자를 그대로 제출하는 경우는 사실상 없습니다.
				그때 원고지가 하는 일은 격자를 출력해 주는 것이 아니라{" "}
				<Link
					to="/guide/$slug"
					params={{ slug: "contest" }}
					className="underline underline-offset-2 hover:text-foreground"
				>
					규정 숫자인 매수를 정확히 내는 것
				</Link>
				입니다.
			</P>
		</>
	);
}
