import { afterEach, expect, it, vi } from "vitest";

const { social, trackLoginStart, clearLoginAttempt } = vi.hoisted(() => ({
	social: vi.fn(),
	trackLoginStart: vi.fn(),
	clearLoginAttempt: vi.fn(),
}));
vi.mock("#/shared/api/auth-client", () => ({
	authClient: { signIn: { social } },
}));
vi.mock("#/shared/lib/analytics", () => ({
	trackLoginStart,
	clearLoginAttempt,
}));

import { signInWithGoogle } from "./use-session";

afterEach(() => {
	vi.resetAllMocks();
	vi.unstubAllGlobals();
});

it("does not start the redirecting auth request before analytics settles", async () => {
	vi.stubGlobal("window", { location: { pathname: "/" } });
	let finish = () => {};
	trackLoginStart.mockReturnValue(
		new Promise<void>((resolve) => {
			finish = resolve;
		}),
	);
	social.mockResolvedValue({ data: {}, error: null });
	const login = signInWithGoogle();
	expect(social).not.toHaveBeenCalled();
	finish();
	await login;
	expect(social).toHaveBeenCalledExactlyOnceWith({
		provider: "google",
		callbackURL: "/",
	});
});

it("still clears the attempt when authentication fails", async () => {
	vi.stubGlobal("window", { location: { pathname: "/" } });
	trackLoginStart.mockResolvedValue(undefined);
	social.mockRejectedValue(new Error("auth failed"));
	await expect(signInWithGoogle()).rejects.toThrow("auth failed");
	expect(clearLoginAttempt).toHaveBeenCalledOnce();
});
