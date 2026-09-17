import {
	TEMPLATE_COLORS,
	TEMPLATE_PAPER,
	type TemplateOptions,
	templateFileName,
	templateLayout,
} from "#/entities/manuscript";

/** pHYs 청크에 300dpi를 기록해 PNG의 인쇄 크기를 유지한다. */
async function withPrintResolution(blob: Blob): Promise<Blob> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const chunk = new Uint8Array(21);
	const view = new DataView(chunk.buffer);
	view.setUint32(0, 9);
	chunk.set([112, 72, 89, 115], 4);
	view.setUint32(8, Math.round(300 / 0.0254));
	view.setUint32(12, Math.round(300 / 0.0254));
	chunk[16] = 1;
	let crc = 0xffffffff;
	for (const byte of chunk.subarray(4, 17)) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++)
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
	const parts: BlobPart[] = [bytes.slice(0, 33), chunk];
	for (let offset = 33; offset < bytes.length; ) {
		const length =
			new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0) +
			12;
		const isResolution =
			bytes[offset + 4] === 112 &&
			bytes[offset + 5] === 72 &&
			bytes[offset + 6] === 89 &&
			bytes[offset + 7] === 115;
		if (!isResolution) parts.push(bytes.slice(offset, offset + length));
		offset += length;
	}
	return new Blob(parts, { type: "image/png" });
}

export async function buildTemplatePng(
	options: TemplateOptions,
	onProgress: (completed: number, packing?: boolean) => void,
	signal: AbortSignal,
): Promise<{ blob: Blob; extension: "png" | "zip" }> {
	const canvas = document.createElement("canvas");
	canvas.width = Math.round((TEMPLATE_PAPER.width / 25.4) * 300);
	canvas.height = Math.round((TEMPLATE_PAPER.height / 25.4) * 300);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("이 브라우저에서는 PNG를 만들 수 없습니다.");
	const zip = options.pages > 1 ? new (await import("jszip")).default() : null;
	const color =
		TEMPLATE_COLORS.find((item) => item.value === options.color)?.hex ??
		"#b95b52";
	const scale = canvas.width / TEMPLATE_PAPER.width;
	try {
		for (let index = 0; index < options.pages; index++) {
			signal.throwIfAborted();
			const { lines, number } = templateLayout(
				options.format,
				options.start + index,
			);
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.fillStyle = "white";
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.setTransform(scale, 0, 0, scale, 0, 0);
			context.strokeStyle = color;
			for (const line of lines) {
				context.lineWidth = line.width;
				context.beginPath();
				context.moveTo(line.x1, line.y1);
				context.lineTo(line.x2, line.y2);
				context.stroke();
			}
			context.fillStyle = color;
			context.font = `${number.size}px Helvetica, Arial, sans-serif`;
			context.textAlign = "right";
			context.fillText(`No. ${options.start + index}`, number.x, number.y);
			const raw = await new Promise<Blob>((resolve, reject) =>
				canvas.toBlob(
					(blob) =>
						blob
							? resolve(blob)
							: reject(new Error("PNG를 만들지 못했습니다.")),
					"image/png",
				),
			);
			const blob = await withPrintResolution(raw);
			signal.throwIfAborted();
			onProgress(index + 1);
			if (!zip) return { blob, extension: "png" };
			zip.file(
				`wongoji-${options.format}-${options.color}-No.${String(options.start + index).padStart(String(options.start + options.pages - 1).length, "0")}.png`,
				await blob.arrayBuffer(),
			);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		}
		if (!zip) throw new Error("다운로드할 페이지가 없습니다.");
		onProgress(options.pages, true);
		const blob = await zip.generateAsync(
			{ type: "blob", compression: "STORE", streamFiles: true },
			() => signal.throwIfAborted(),
		);
		signal.throwIfAborted();
		return { blob, extension: "zip" };
	} finally {
		canvas.width = 0;
		canvas.height = 0;
	}
}

export function saveTemplate(
	blob: Blob,
	options: TemplateOptions,
	extension: "pdf" | "png" | "zip",
) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${templateFileName(options)}.${extension}`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
