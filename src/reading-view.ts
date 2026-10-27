import { MarkdownPostProcessorContext, TFile } from "obsidian";
import type TableStylesPlugin from "./main";
import { ensureToolbar, removeToolbar } from "./toolbar";
import {
	TableRef,
	applyStyle,
	effective,
	findMarker,
	parseMarker,
	withMarker,
} from "./table-style";

/** Acha a tabela na nota a partir do pedaço renderizado no modo leitura. */
function readingRef(
	plugin: TableStylesPlugin,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): TableRef {
	const locate = () => {
		const info = ctx.getSectionInfo(el);
		if (!info) return null;
		const lines = info.text.split(/\r?\n/);
		let tableLine = info.lineStart;
		// O marcador pode vir junto no mesmo bloco da tabela.
		if (parseMarker(lines[tableLine]) && tableLine < info.lineEnd) tableLine++;
		return { lines, tableLine };
	};

	return {
		read: () => {
			const found = locate();
			if (!found) return null;
			const marker = findMarker((n) => found.lines[n], found.tableLine);
			return marker >= 0 ? parseMarker(found.lines[marker]) ?? {} : {};
		},
		write: async (style) => {
			const found = locate();
			const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
			if (!found || !(file instanceof TFile)) return false;
			const header = found.lines[found.tableLine];
			let ok = true;
			await plugin.app.vault.process(file, (data) => {
				const eol = data.includes("\r\n") ? "\r\n" : "\n";
				const lines = data.split(/\r?\n/);
				// A nota mudou desde que a tabela foi desenhada.
				if (lines[found.tableLine] !== header) {
					ok = false;
					return data;
				}
				return withMarker(lines, found.tableLine, style).join(eol);
			});
			return ok;
		},
	};
}

export function registerReadingView(plugin: TableStylesPlugin) {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const tables = el.findAll("table");
		if (!tables.length) return;
		const ref = readingRef(plugin, el, ctx);

		const apply = () => {
			const settings = plugin.settings;
			const style = ref.read();
			for (const table of tables) applyStyle(table, effective(style ?? {}, settings), settings);
			// Só dá para gravar quando o bloco tem uma tabela só.
			if (style !== null && tables.length === 1 && settings.toolbar) {
				ensureToolbar(plugin, el, () => el.find("table"), () => ref);
			} else {
				removeToolbar(el);
			}
			return style !== null;
		};

		// Às vezes a posição do bloco na nota só fica pronta depois.
		if (!apply()) requestAnimationFrame(apply);
	});
}
