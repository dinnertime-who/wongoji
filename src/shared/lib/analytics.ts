type AuthState = "guest" | "signed_in";
type Parameters = Record<string, string | number | boolean>;
type Gtag = (...args: unknown[]) => void;

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: Gtag;
	}
}

const GUEST_WRITE = "wongoji:analytics:guest-write";
const LOGIN_ATTEMPT = "wongoji:analytics:login-attempt";
const DAY = 24 * 60 * 60 * 1000;
const LOGIN_EVENT_TIMEOUT = 1000;
const written = new Set<AuthState>();
let initialized = false;
let previousPath: string | undefined;

/** 원고 식별자와 검색어, OAuth 파라미터가 GA에 실리지 않도록 경로를 제한한다. */
export function analyticsPath(path: string): string {
	const pathname = path.split(/[?#]/)[0];
	if (pathname === "/" || pathname === "/library") return pathname;
	if (pathname.startsWith("/w/")) return "/w/:docId";
	if (pathname.startsWith("/f/")) return "/f/:folderId";
	if (pathname === "/guide" || pathname.startsWith("/guide/")) return "/guide";
	return "/other";
}

function context(): Parameters {
	return {
		page_location:
			window.location.origin + analyticsPath(window.location.pathname),
		page_title: "원고지",
	};
}

function init(): boolean {
	const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
	if (
		typeof window === "undefined" ||
		!/^G-[A-Z0-9]+$/.test(id ?? "") ||
		(!import.meta.env.PROD && import.meta.env.VITE_GA_DEBUG !== "true")
	)
		return false;
	if (initialized) return true;
	try {
		window.dataLayer ??= [];
		window.gtag ??= function () {
			// gtag.js의 공식 큐 형식은 배열이 아닌 arguments 객체다.
			// biome-ignore lint/complexity/noArguments: Google tag의 arguments 큐 규약.
			window.dataLayer?.push(arguments);
		};
		window.gtag("js", new Date());
		let referrer = "";
		if (document.referrer) {
			const url = new URL(document.referrer);
			referrer =
				url.origin === window.location.origin
					? url.origin + analyticsPath(url.pathname)
					: url.origin;
		}
		window.gtag("config", id, {
			...context(),
			page_referrer: referrer,
			send_page_view: false,
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
			...(import.meta.env.VITE_GA_DEBUG === "true" ? { debug_mode: true } : {}),
		});
		const script = document.createElement("script");
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
		document.head.appendChild(script);
		initialized = true;
		return true;
	} catch {
		return false;
	}
}

function event(name: string, params: Parameters): void {
	if (!init()) return;
	try {
		window.gtag?.("event", name, { ...context(), ...params });
	} catch {
		// 수집 실패가 사용자 작업을 막아서는 안 된다.
	}
}

function storage(
	kind: "localStorage" | "sessionStorage",
	key: string,
	value?: string | null,
): string | null {
	try {
		if (value === null) window[kind].removeItem(key);
		else if (value !== undefined) window[kind].setItem(key, value);
		return window[kind].getItem(key);
	} catch {
		return null;
	}
}

function recent(value: string | null, age: number): boolean {
	if (!value) return false;
	const elapsed = Date.now() - Number(value);
	return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < age;
}

export function trackPageView(path: string, signedIn: boolean): void {
	if (!init() || path === previousPath) return;
	const params: Parameters = { auth_state: signedIn ? "signed_in" : "guest" };
	if (previousPath !== undefined) {
		params.page_referrer = window.location.origin + analyticsPath(previousPath);
	}
	// 자동 engagement 이벤트에도 마지막 화면의 안전한 주소를 사용한다.
	try {
		window.gtag?.("config", import.meta.env.VITE_GA_MEASUREMENT_ID, {
			...context(),
			...params,
			send_page_view: false,
		});
	} catch {
		return;
	}
	previousPath = path;
	event("page_view", params);
}

/** 실제 본문 편집에서만 호출. 복원·최초 조판·제목 변경은 포함하지 않는다. */
export function trackWriting(signedIn: boolean): void {
	if (!init()) return;
	const authState = signedIn ? "signed_in" : "guest";
	if (written.has(authState)) return;
	if (!signedIn) storage("localStorage", GUEST_WRITE, String(Date.now()));
	written.add(authState);
	event("writing_started", { auth_state: authState });
}

/** 파일 생성 후 브라우저에 다운로드를 요청한 시점. 디스크 저장 완료는 알 수 없다. */
export function trackDownload(
	signedIn: boolean,
	fileExtension: "txt" | "docx" | "zip",
	scope: "manuscript" | "folder" | "archive",
): void {
	event("file_download", {
		auth_state: signedIn ? "signed_in" : "guest",
		file_extension: fileExtension,
		download_scope: scope,
	});
}

export async function trackLoginStart(): Promise<void> {
	if (!init()) return;
	storage("sessionStorage", LOGIN_ATTEMPT, String(Date.now()));
	await new Promise<void>((resolve) => {
		const finish = () => {
			clearTimeout(timer);
			resolve();
		};
		// 태그가 차단되면 GA 자체 timeout도 실행되지 않으므로 별도로 제한한다.
		const timer = setTimeout(finish, LOGIN_EVENT_TIMEOUT);
		try {
			window.gtag?.("event", "login_started", {
				...context(),
				method: "google",
				auth_state: "guest",
				entry_point: analyticsPath(window.location.pathname),
				event_callback: finish,
				event_timeout: LOGIN_EVENT_TIMEOUT,
			});
		} catch {
			finish();
		}
	});
}

export function clearLoginAttempt(): void {
	storage("sessionStorage", LOGIN_ATTEMPT, null);
}

/** 클릭 이력 + 인증된 세션이 함께 있어야 성공이다. 새로고침은 성공이 아니다. */
export function trackLoginComplete(signedIn: boolean): void {
	if (!init() || !signedIn) return;
	const attempt = storage("sessionStorage", LOGIN_ATTEMPT);
	clearLoginAttempt();
	if (!recent(attempt, 30 * 60 * 1000)) return;
	event("login", { method: "google", auth_state: "signed_in" });
	if (recent(storage("localStorage", GUEST_WRITE), 30 * DAY)) {
		storage("localStorage", GUEST_WRITE, null);
		event("guest_to_login", { method: "google", auth_state: "signed_in" });
	}
}
