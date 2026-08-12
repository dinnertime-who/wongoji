import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";

/**
 * 되돌릴 수 없는 일을 하기 전에 묻는 창.
 *
 * 이 앱에서 확인을 받는 것은 되돌릴 수 없는 일뿐이다. 휴지통으로 보내는 것은
 * 묻지 않는다 — 30일 동안 되살릴 수 있는 일에 확인을 받으면 확인 자체가
 * 값싸져서, 정작 물어야 할 때 그냥 눌러 버리게 된다.
 *
 * 그래서 확인 버튼은 늘 파괴적인 색이다. 고를 일이 아니라 이 창의 성질이다.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: React.ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-white hover:bg-destructive/90"
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
