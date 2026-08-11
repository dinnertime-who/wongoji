import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";

/**
 * 이름 하나를 받는 창.
 *
 * 폴더를 만들 때도 이름을 바꿀 때도 필요한 것이 같아서 한 벌만 둔다.
 * `window.prompt`을 쓰지 않는 이유는 생김새가 앱과 따로 놀기 때문이다.
 */
export function NameDialog({
	open,
	onOpenChange,
	title,
	description,
	initial = "",
	confirmLabel = "만들기",
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	initial?: string;
	confirmLabel?: string;
	onConfirm: (name: string) => void;
}) {
	const [name, setName] = useState(initial);

	// 열 때마다 처음 값으로 되돌린다. 닫힌 동안에도 살아 있는 컴포넌트다
	useEffect(() => {
		if (open) setName(initial);
	}, [open, initial]);

	const trimmed = name.trim();

	const submit = () => {
		if (!trimmed) return;
		onConfirm(trimmed);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
				>
					{/* 열리자마자 바로 칠 수 있어야 한다 */}
					<Input
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={80}
						aria-label={title}
					/>
					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onOpenChange(false)}
						>
							취소
						</Button>
						<Button type="submit" size="sm" disabled={!trimmed}>
							{confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
