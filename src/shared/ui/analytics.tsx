import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSessionUser } from "#/shared/api/session";
import { trackLoginComplete, trackPageView } from "#/shared/lib/analytics";

export function Analytics() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const signedIn = useSessionUser() !== null;

	useEffect(() => {
		trackPageView(pathname, signedIn);
		trackLoginComplete(signedIn);
	}, [pathname, signedIn]);

	return null;
}
