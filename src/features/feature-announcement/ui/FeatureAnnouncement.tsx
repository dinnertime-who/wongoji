import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DownloadIcon, XIcon } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useUserId } from "#/shared/api/session";
import { TEMPLATE_DOWNLOAD_ANNOUNCEMENT } from "#/shared/config/announcement";
import { Button } from "#/shared/ui/button";

type Announcement = typeof TEMPLATE_DOWNLOAD_ANNOUNCEMENT;
type LoadAnnouncement = () => Promise<{
	userId: string;
	announcement: Announcement | null;
} | null>;
type HideAnnouncement = () => Promise<{ success: true }>;

const AnnouncementContent = createContext<ReactNode>(null);

export function FeatureAnnouncementBanner() {
	return useContext(AnnouncementContent);
}

export function FeatureAnnouncement(props: {
	load: LoadAnnouncement;
	hide: HideAnnouncement;
	children: ReactNode;
}) {
	const userId = useUserId();
	if (!userId) return props.children;
	return <AccountAnnouncement key={userId} userId={userId} {...props} />;
}

function AccountAnnouncement({
	userId,
	load,
	hide,
	children,
}: {
	userId: string;
	load: LoadAnnouncement;
	hide: HideAnnouncement;
	children: ReactNode;
}) {
	const client = useQueryClient();
	const queryKey = ["announcement", userId, TEMPLATE_DOWNLOAD_ANNOUNCEMENT.id];
	const { data, isFetchedAfterMount } = useQuery({
		queryKey,
		queryFn: load,
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
	const [closed, setClosed] = useState(false);
	const [expired, setExpired] = useState(false);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const saving = useRef(false);
	const announcement = data?.userId === userId ? data.announcement : null;

	useEffect(() => {
		if (!announcement) return;
		const timer = window.setTimeout(
			() => setExpired(true),
			Math.max(0, Date.parse(announcement.endsAt) - Date.now()),
		);
		return () => window.clearTimeout(timer);
	}, [announcement]);

	const dismiss = async () => {
		if (saving.current) return;
		saving.current = true;
		setBusy(true);
		setFailed(false);
		try {
			await hide();
			await client.cancelQueries({ queryKey });
			client.setQueryData(queryKey, { userId, announcement: null });
			setClosed(true);
		} catch {
			setFailed(true);
		} finally {
			saving.current = false;
			setBusy(false);
		}
	};

	const visible = announcement && isFetchedAfterMount && !closed && !expired;
	const banner = visible ? (
		<aside
			aria-label="원고지 소식"
			className="border-t border-l-3 border-grid/50 border-l-grid bg-grid-soft px-3 py-2 sm:px-4"
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:flex sm:gap-3">
				<p className="min-w-0 text-xs font-medium leading-5 sm:flex-1">
					{announcement.title}
				</p>
				<div className="col-span-2 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:ml-auto">
					<Link
						to="/templates"
						onClick={() => setClosed(true)}
						className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-xs font-medium underline underline-offset-4 outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						<DownloadIcon aria-hidden="true" className="size-3.5" />
						양식 다운로드
					</Link>
					<Button
						variant="ghost"
						size="sm"
						className="min-h-8 text-xs text-foreground/70"
						disabled={busy}
						onClick={() => void dismiss()}
					>
						{busy ? "저장 중…" : "다시 보지 않기"}
					</Button>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="col-start-2 row-start-1 -mr-1 text-foreground/70"
					aria-label="소식 닫기"
					title="현재 접속 중에는 숨기기"
					onClick={() => setClosed(true)}
				>
					<XIcon aria-hidden="true" />
				</Button>
			</div>
			{failed && (
				<p role="alert" className="mt-1 text-xs text-destructive">
					설정을 저장하지 못했어요. 다시 시도해주세요.
				</p>
			)}
		</aside>
	) : null;

	return (
		<AnnouncementContent.Provider value={banner}>
			{children}
		</AnnouncementContent.Provider>
	);
}
