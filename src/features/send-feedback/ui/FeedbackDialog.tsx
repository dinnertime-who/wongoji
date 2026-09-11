import { useLocation } from "@tanstack/react-router";
import { MessageSquareTextIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useSessionUser } from "#/shared/api/session";
import { Button } from "#/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/shared/ui/dialog";
import { Input } from "#/shared/ui/input";
import { Label } from "#/shared/ui/label";
import {
	FEEDBACK_MESSAGE_MAX,
	FEEDBACK_TYPE_LABEL,
	FEEDBACK_TYPES,
	type FeedbackInput,
	type FeedbackType,
	isValidEmail,
} from "../model/feedback";

type SendFeedback = (options: {
	data: FeedbackInput;
}) => Promise<{ success: true }>;

interface FormErrors {
	type?: string;
	message?: string;
	email?: string;
}

/** 어느 쪽에서든 운영자에게 짧은 의견을 보낼 수 있는 창. */
export function FeedbackDialog({ send }: { send: SendFeedback }) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const user = useSessionUser();
	const [open, setOpen] = useState(false);
	const [type, setType] = useState<FeedbackType | "">("");
	const [message, setMessage] = useState("");
	const [email, setEmail] = useState("");
	const [errors, setErrors] = useState<FormErrors>({});
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const [sent, setSent] = useState(false);
	// state가 다시 그려지기 전의 빠른 두 번째 submit까지 막는다
	const submitting = useRef(false);

	const changeOpen = (next: boolean) => {
		if (busy) return;
		setOpen(next);
		if (!next) return;

		setType("");
		setMessage("");
		setEmail(user?.email ?? "");
		setErrors({});
		setFailed(false);
		setSent(false);
	};

	const validate = (): FormErrors => {
		const next: FormErrors = {};
		if (!type) next.type = "의견 유형을 선택해주세요.";
		if (!message.trim()) next.message = "의견을 입력해주세요.";
		else if (message.length > FEEDBACK_MESSAGE_MAX) {
			next.message = `의견은 ${FEEDBACK_MESSAGE_MAX}자까지 입력할 수 있습니다.`;
		}
		if (email.trim() && !isValidEmail(email.trim())) {
			next.email = "올바른 이메일 주소를 입력해주세요.";
		}
		return next;
	};

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submitting.current) return;

		const nextErrors = validate();
		setErrors(nextErrors);
		setFailed(false);
		if (Object.keys(nextErrors).length > 0 || !type) return;

		submitting.current = true;
		setBusy(true);
		try {
			await send({
				data: {
					type,
					message,
					email: email.trim() || undefined,
					path: pathname,
				},
			});
			setType("");
			setMessage("");
			setEmail("");
			setSent(true);
		} catch {
			setFailed(true);
		} finally {
			submitting.current = false;
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="fixed right-4 bottom-16 z-20 bg-[var(--paper)] shadow-sm lg:bottom-4"
				>
					<MessageSquareTextIcon />
					의견 보내기
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				{sent ? (
					<>
						<DialogHeader>
							<DialogTitle>의견 감사합니다.</DialogTitle>
							<DialogDescription>
								보내주신 내용을 확인해볼게요.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" size="sm" onClick={() => setOpen(false)}>
								닫기
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>의견 보내기</DialogTitle>
							<DialogDescription>
								불편했던 점이나 바라는 점을 알려주세요.
							</DialogDescription>
						</DialogHeader>

						<form onSubmit={submit} noValidate>
							<div className="space-y-4">
								<fieldset className="space-y-2">
									<legend className="font-medium text-sm">의견 유형</legend>
									<div className="grid grid-cols-3 gap-2">
										{FEEDBACK_TYPES.map((value) => (
											<label
												key={value}
												className="cursor-pointer rounded-lg border border-input px-2 py-2 text-center text-sm transition-colors has-checked:border-grid has-checked:bg-grid-soft"
											>
												<input
													type="radio"
													name="feedback-type"
													value={value}
													checked={type === value}
													onChange={() => {
														setType(value);
														setErrors((current) => ({
															...current,
															type: undefined,
														}));
													}}
													className="sr-only"
												/>
												{FEEDBACK_TYPE_LABEL[value]}
											</label>
										))}
									</div>
									{errors.type && (
										<p className="text-destructive text-xs">{errors.type}</p>
									)}
								</fieldset>

								<div className="space-y-2">
									<div className="flex items-baseline justify-between gap-4">
										<Label htmlFor="feedback-message">의견</Label>
										<span className="text-muted-foreground text-xs tabular-nums">
											{message.length.toLocaleString()} /{" "}
											{FEEDBACK_MESSAGE_MAX.toLocaleString()}
										</span>
									</div>
									<textarea
										id="feedback-message"
										value={message}
										onChange={(event) => {
											setMessage(event.target.value);
											setErrors((current) => ({
												...current,
												message: undefined,
											}));
										}}
										maxLength={FEEDBACK_MESSAGE_MAX}
										rows={7}
										placeholder="사용하면서 불편했던 점이나 개선되었으면 하는 점을 자유롭게 알려주세요."
										aria-invalid={Boolean(errors.message)}
										aria-describedby={
											errors.message ? "feedback-message-error" : undefined
										}
										className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
									/>
									{errors.message && (
										<p
											id="feedback-message-error"
											className="text-destructive text-xs"
										>
											{errors.message}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="feedback-email">이메일 (선택)</Label>
									<Input
										id="feedback-email"
										type="email"
										value={email}
										onChange={(event) => {
											setEmail(event.target.value);
											setErrors((current) => ({
												...current,
												email: undefined,
											}));
										}}
										placeholder="you@example.com"
										maxLength={254}
										aria-invalid={Boolean(errors.email)}
										aria-describedby="feedback-email-help"
									/>
									<p
										id="feedback-email-help"
										className="text-muted-foreground text-xs"
									>
										{errors.email ?? "답변이 필요한 경우 입력해주세요."}
									</p>
								</div>

								{failed && (
									<p role="alert" className="text-destructive text-sm">
										의견을 보내지 못했습니다. 잠시 후 다시 시도해주세요.
									</p>
								)}
							</div>

							<DialogFooter className="mt-4">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={busy}
									onClick={() => setOpen(false)}
								>
									취소
								</Button>
								<Button type="submit" size="sm" disabled={busy}>
									{busy ? "보내는 중…" : "보내기"}
								</Button>
							</DialogFooter>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
