import { MarkdownPostProcessorContext, Menu, TFile } from "obsidian";
import type TableStylesPlugin from "./main";
import { ensureToolbar, removeToolbar } from "./toolbar";
import {
	ALIGN_NAMES,
	Align,
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

	/** Troca linhas da nota, conferindo antes que a tabela ainda está lá. */
	const edit = async (fn: (lines: string[], tableLine: number) => string[]) => {
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
			return fn(lines, found.tableLine).join(eol);
		});
		return ok;
	};

	return {
		read: () => {
			const found = locate();
			if (!found) return null;
			const marker = findMarker((n) => found.lines[n], found.tableLine);
			return marker >= 0 ? parseMarker(found.lines[marker]) ?? {} : {};
		},
		write: (style) => edit((lines, tableLine) => withMarker(lines, tableLine, style)),
		readDelimiter: () => {
			const found = locate();
			return found?.lines[found.tableLine + 1] ?? null;
		},
		writeDelimiter: (text) =>
			edit((lines, tableLine) => {
				const out = lines.slice();
				out[tableLine + 1] = text;
				return out;
			}),
	};
}

/** Menu de alinhamento ao clicar com o botão direito num cabeçalho. */
function headerMenu(plugin: TableStylesPlugin, table: HTMLElement, ref: TableRef) {
	table.addEventListener("contextmenu", (evt) => {
		const th = (evt.target as HTMLElement).closest("th");
		if (!th || !table.contains(th)) return;
		evt.preventDefault();
		const menu = new Menu();
		for (const align of ["left", "center", "right"] as Align[]) {
			menu.addItem((item) =>
				item
					.setTitle(`Align column: ${ALIGN_NAMES[align].toLowerCase()}`)
					.setIcon(`align-${align}`)
					.onClick(() => void plugin.alignColumn(ref, th.cellIndex, align))
			);
		}
		menu.showAtMouseEvent(evt);
	});
}

export function registerReadingView(plugin: TableStylesPlugin) {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const tables = el.findAll("table");
		if (!tables.length) return;
		const ref = readingRef(plugin, el, ctx);
		let menuAdded = false;

		const apply = () => {
			const settings = plugin.settings;
			const style = ref.read();
			for (const table of tables) applyStyle(table, effective(style ?? {}, settings), settings);
			// Só dá para gravar quando o bloco tem uma tabela só.
			const single = style !== null && tables.length === 1;
			if (single && !menuAdded) {
				headerMenu(plugin, tables[0], ref);
				menuAdded = true;
			}
			if (single && (settings.toolbar || settings.handles)) {
				ensureToolbar(plugin, el, () => el.find("table") as HTMLTableElement | null, () => ref);
			} else {
				removeToolbar(el);
			}
			return style !== null;
		};

		// Às vezes a posição do bloco na nota só fica pronta depois.
		if (!apply()) window.requestAnimationFrame(apply);
	});
}
