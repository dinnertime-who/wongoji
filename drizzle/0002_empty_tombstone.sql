ALTER TABLE `archive_doc` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_folder` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- 있던 행에 자리를 매긴다.
--
-- 기본값 0을 그대로 두면 한 폴더의 모든 형제가 동률이 된다. 브라우저의 정렬이
-- 동률을 이름·시각으로 가르므로 목록은 멀쩡해 보이지만, 그 자리는 **영영 옛
-- 규칙대로 움직인다** — 원고를 고칠 때마다 맨 위로 튀어 오른다. 게다가 받아온
-- 색인이 로컬을 덮으므로, 이 기기에서 이미 정해 둔 차례까지 함께 지워진다.
--
-- 그래서 판을 올리던 브라우저(entities/archive/model/migrate.ts)와 같은 규칙으로
-- 여기서도 매긴다. 앞서는 형제가 몇인지 세면 그것이 0부터 시작하는 자리다.
--
-- 폴더 이름은 SQLite의 기본 정렬(BINARY)로 견준다. 한글 음절은 코드포인트
-- 차례가 곧 가나다 차례라 localeCompare("ko")와 같고, 글자가 섞이면 조금
-- 다를 수 있다. 한 번 깔아 주는 값이고 그다음부터는 사람이 정한다.
UPDATE `archive_doc` SET `sort_order` = (
	SELECT COUNT(*) FROM `archive_doc` AS peer
	WHERE peer.`user_id` = `archive_doc`.`user_id`
		AND peer.`path` = `archive_doc`.`path`
		AND (peer.`updated_at` > `archive_doc`.`updated_at`
			OR (peer.`updated_at` = `archive_doc`.`updated_at` AND peer.`id` < `archive_doc`.`id`))
);--> statement-breakpoint

UPDATE `archive_folder` SET `sort_order` = (
	SELECT COUNT(*) FROM `archive_folder` AS peer
	WHERE peer.`user_id` = `archive_folder`.`user_id`
		AND peer.`path` = `archive_folder`.`path`
		AND (peer.`name` < `archive_folder`.`name`
			OR (peer.`name` = `archive_folder`.`name` AND peer.`id` < `archive_folder`.`id`))
);
