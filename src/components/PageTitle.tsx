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
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	label: string;
}) {
	return (
		<input
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			aria-label={label}
			// 자동 채우기가 사람 이름이나 제목을 넣으려 든다
			autoComplete="off"
			spellCheck={false}
			className="w-full border-0 bg-transparent p-0 font-bold text-3xl leading-tight tracking-tight outline-none placeholder:font-bold placeholder:text-muted-foreground/45"
		/>
	);
}
