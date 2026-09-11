import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
}

const appendChild = vi.fn();
let analytics: typeof import("./analytics");

function commands(): unknown[][] {
	return (window.dataLayer ?? []).map((item) => Array.from(item as IArguments));
}

function events(name?: string) {
	return commands().filter(
		(item) => item[0] === "event" && (!name || item[1] === name),
	);
}

beforeEach(async () => {
	vi.resetModules();
	vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
	vi.stubEnv("PROD", true);
	vi.stubEnv("VITE_GA_DEBUG", "false");
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
	appendChild.mockClear();
	vi.stubGlobal("window", {
		location: { origin: "https://example.com", pathname: "/" },
		localStorage: memoryStorage(),
		sessionStorage: memoryStorage(),
	});
	vi.stubGlobal("document", {
		referrer: "https://search.example.com/?q=private",
		createElement: () => ({}),
		head: { appendChild },
	});
	analytics = await import("./analytics");
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("GA collection boundaries", () => {
	it("is disabled without a measurement ID, in normal development, and during SSR", () => {
		vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
		analytics.trackWriting(false);
		vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
		vi.stubEnv("PROD", false);
		analytics.trackWriting(false);
		expect(appendChild).not.toHaveBeenCalled();
		vi.stubGlobal("window", undefined);
		expect(() => analytics.trackLoginComplete(true)).not.toThrow();
	});

	it("initializes once, counts real navigation, and strips private URLs", () => {
		window.location.pathname = "/w/private-document";
		analytics.trackPageView(window.location.pathname, true);
		analytics.trackPageView(window.location.pathname, true);
		window.location.pathname = "/f/private-folder";
		analytics.trackPageView(window.location.pathname, true);
		expect(appendChild).toHaveBeenCalledTimes(1);
		expect(events("page_view")).toHaveLength(2);
		const payload = JSON.stringify(commands());
		expect(payload).not.toContain("private");
		expect(payload).toContain("/w/:docId");
		expect(payload).toContain("/f/:folderId");
		expect(analytics.analyticsPath("/unexpected-secret?token=secret")).toBe(
			"/other",
		);
	});

	it("counts repeated edits once per auth state per page lifetime", () => {
		analytics.trackWriting(false);
		analytics.trackWriting(false);
		analytics.trackWriting(true);
		expect(events("writing_started").map((item) => item[2])).toMatchObject([
			{ auth_state: "guest" },
			{ auth_state: "signed_in" },
		]);
	});

	it("never counts an existing authenticated session or an unfinished login as conversion", () => {
		analytics.trackLoginComplete(true);
		analytics.trackWriting(false);
		analytics.trackLoginStart();
		analytics.trackLoginComplete(false);
		expect(events("login")).toHaveLength(0);
		expect(events("guest_to_login")).toHaveLength(0);
	});

	it("preserves guest history across OAuth reload and consumes success exactly once", async () => {
		analytics.trackWriting(false);
		analytics.trackLoginStart();
		vi.resetModules();
		analytics = await import("./analytics");
		analytics.trackLoginComplete(true);
		analytics.trackLoginComplete(true);
		expect(events("login")).toHaveLength(1);
		expect(events("guest_to_login")).toHaveLength(1);
	});

	it("records login without conversion when the person has never written as a guest", () => {
		analytics.trackLoginStart();
		analytics.trackLoginComplete(true);
		expect(events("login")).toHaveLength(1);
		expect(events("guest_to_login")).toHaveLength(0);
	});

	it("expires abandoned attempts after 30 minutes", () => {
		analytics.trackWriting(false);
		analytics.trackLoginStart();
		vi.advanceTimersByTime(30 * 60 * 1000);
		analytics.trackLoginComplete(true);
		expect(events("login")).toHaveLength(0);
	});

	it("expires guest writing history after 30 days", () => {
		analytics.trackWriting(false);
		vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
		analytics.trackLoginStart();
		analytics.trackLoginComplete(true);
		expect(events("login")).toHaveLength(1);
		expect(events("guest_to_login")).toHaveLength(0);
	});

	it("clears failed attempts and tolerates blocked storage and tags", () => {
		analytics.trackLoginStart();
		analytics.clearLoginAttempt();
		analytics.trackLoginComplete(true);
		expect(events("login")).toHaveLength(0);
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("blocked");
			},
		});
		Object.defineProperty(window, "sessionStorage", {
			get() {
				throw new Error("blocked");
			},
		});
		window.gtag = () => {
			throw new Error("blocked");
		};
		expect(() => {
			analytics.trackWriting(false);
			analytics.trackLoginStart();
			analytics.trackLoginComplete(true);
			analytics.trackPageView("/", false);
		}).not.toThrow();
	});
});
