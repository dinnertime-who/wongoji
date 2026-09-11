/**
 * 문서의 이름. 원고의 제목이자 폴더의 이름이다.
 *
 * 테두리도 배경도 두지 않는다. 이것은 채워 넣을 칸이 아니라 이미 적혀 있는
 * 글의 머리이고, 고칠 수 있을 뿐이다. 눌러야 고쳐지는 것을 알리는 일은
 * 커서에 맡긴다.
 */
export function PageTitle({
	value,
	onChange,
	placeholder,
	label,
	wrap = false,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	label: string;
	/** 긴 이름을 여러 줄로 보여 준다. 제목처럼 세로 공간을 써도 되는 자리에서만 켠다. */
	wrap?: boolean;
}) {
	const className =
		"w-full border-0 bg-transparent p-0 font-bold text-3xl leading-tight tracking-tight outline-none placeholder:font-bold placeholder:text-muted-foreground/45";

	if (wrap) {
		return (
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
				onKeyDown={(e) => {
					// 줄은 화면 너비에 따라 저절로 접히되 제목 값에는 줄바꿈을 넣지 않는다.
					if (e.key === "Enter") e.preventDefault();
				}}
				placeholder={placeholder}
				aria-label={label}
				rows={1}
				// 자동 채우기가 사람 이름이나 제목을 넣으려 든다
				autoComplete="off"
				spellCheck={false}
				className={`${className} field-sizing-content resize-none overflow-hidden`}
			/>
		);
	}

	return (
		<input
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			aria-label={label}
			// 자동 채우기가 사람 이름이나 제목을 넣으려 든다
			autoComplete="off"
			spellCheck={false}
			className={className}
		/>
	);
}
