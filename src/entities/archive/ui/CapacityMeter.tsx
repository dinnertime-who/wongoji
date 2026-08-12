import { SHEET_LIMIT } from "../config/limits";
import { usedSheets } from "../model/operations";
import { useStoreIndex } from "../model/use-store-index";

/** 이 비율을 넘으면 미리 알린다. 꽉 찬 뒤에 알리면 늦다 */
const NEAR = 0.9;

/**
 * 보관함이 쓴 분량.
 *
 * 막지 않는다. 글을 쓰는 도중에 입력을 거절하면 방금 쓴 문장이 갈 곳을 잃는다.
 * 한도를 넘겨도 계속 쓸 수 있게 두고, 색으로만 알린다.
 */
export function CapacityMeter() {
	const index = useStoreIndex();
	const used = usedSheets(index);
	const over = used >= SHEET_LIMIT;
	const near = !over && used >= SHEET_LIMIT * NEAR;

	const tone = over
		? "text-destructive"
		: near
			? "text-foreground"
			: "text-muted-foreground";

	return (
		<span
			className={tone}
			title={
				over
					? `보관함 한도 ${SHEET_LIMIT}매를 넘었습니다. 쓰던 글은 그대로 저장되지만, 안 쓰는 원고를 정리해 주세요.`
					: `보관함에 든 원고를 모두 더한 분량입니다. 한도 ${SHEET_LIMIT}매`
			}
		>
			{/* 넘긴 뒤에도 실제 매수를 보여준다. 얼마나 넘겼는지가 정리할 단서다 */}
			보관함 {used} / {SHEET_LIMIT}매
		</span>
	);
}
