import { Editor, MarkdownView, Menu, Notice, Plugin, debounce } from "obsidian";
import { LivePreviewTables, livePreviewExtension } from "./live-preview";
import { registerReadingView } from "./reading-view";
import { TableStylesSettingTab } from "./settings";
import { hideToolbar } from "./toolbar";
import {
	ALIGN_NAMES,
	Align,
	DELIMITER_ROW,
	TableAction,
	TableRef,
	TableStylesSettings,
	applyStyle,
	change,
	columnAt,
	effective,
	findMarker,
	formatMarker,
	loadSettings,
	markerBlock,
	parseMarker,
	setAlignment,
} from "./table-style";

const ALIGNS: Align[] = ["left", "center", "right"];

/** A tabela onde está o cursor, no modo de edição, e a coluna dele. */
function editorTable(editor: Editor): { ref: TableRef; col: number } | null {
	const isTableLine = (n: number) => editor.getLine(n).includes("|");
	const cursor = editor.getCursor();
	let start = cursor.line;
	if (!isTableLine(start)) return null;
	while (start > 0 && isTableLine(start - 1)) start--;
	if (start + 1 >= editor.lineCount() || !DELIMITER_ROW.test(editor.getLine(start + 1))) {
		return null;
	}
	const marker = () => findMarker((n) => editor.getLine(n), start);
	const ref: TableRef = {
		read: () => {
			const m = marker();
			return m >= 0 ? parseMarker(editor.getLine(m)) ?? {} : {};
		},
		write: (style) => {
			const m = marker();
			if (m < 0 && !formatMarker(style)) return true;
			const from = m >= 0 ? m : start;
			const above = from > 0 ? editor.getLine(from - 1) : undefined;
			const insert = markerBlock(style, above).map((l) => `${l}\n`).join("");
			editor.replaceRange(insert, { line: from, ch: 0 }, { line: start, ch: 0 });
			return true;
		},
		readDelimiter: () => editor.getLine(start + 1),
		writeDelimiter: (text) => {
			const line = start + 1;
			editor.replaceRange(text, { line, ch: 0 }, { line, ch: editor.getLine(line).length });
			return true;
		},
	};
	return { ref, col: columnAt(editor.getLine(cursor.line), cursor.ch) };
}

export default class TableStylesPlugin extends Plugin {
	settings: TableStylesSettings = loadSettings(null);
	readonly livePreviews = new Set<LivePreviewTables>();

	async onload() {
		this.settings = loadSettings(await this.loadData());
		this.addSettingTab(new TableStylesSettingTab(this.app, this));
		registerReadingView(this);
		this.registerEditorExtension(livePreviewExtension(this));

		const commands: [string, string, TableAction][] = [
			["bigger", "Make table bigger", { type: "bigger" }],
			["smaller", "Make table smaller", { type: "smaller" }],
			// O id antigo continua, para não perder atalhos já configurados.
			["stripes", "Toggle table colors", { type: "toggle-colors" }],
			["reset-colors", "Reset table colors", { type: "reset-colors" }],
			["width", "Toggle table full width", { type: "width" }],
			["auto-size", "Reset table size to automatic", { type: "resize", cols: null, h: null }],
			["reset", "Reset table style", { type: "reset" }],
		];
		for (const [id, name, action] of commands) {
			this.addCommand({
				id,
				name,
				editorCheckCallback: (checking, editor) => {
					const found = editorTable(editor);
					if (checking) return found !== null;
					void this.runAction(found?.ref ?? null, null, action);
					return true;
				},
			});
		}
		for (const align of ALIGNS) {
			this.addCommand({
				id: `align-${align}`,
				name: `Align table column: ${ALIGN_NAMES[align].toLowerCase()}`,
				editorCheckCallback: (checking, editor) => {
					const found = editorTable(editor);
					if (checking) return found !== null;
					if (found) void this.alignColumn(found.ref, found.col, align);
					return true;
				},
			});
		}

		// Botão direito numa tabela no editor: alinhar a coluna do cursor.
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
				const found = editorTable(editor);
				if (!found) return;
				for (const align of ALIGNS) {
					menu.addItem((item) =>
						item
							.setSection("table-style")
							.setTitle(`Align column ${found.col + 1}: ${ALIGN_NAMES[align].toLowerCase()}`)
							.setIcon(`align-${align}`)
							.onClick(() => void this.alignColumn(found.ref, found.col, align))
					);
				}
			})
		);
	}

	onunload() {
		hideToolbar();
	}

	async runAction(ref: TableRef | null, table: HTMLElement | null, action: TableAction) {
		const current = ref?.read() ?? null;
		if (!ref || current === null) {
			new Notice("Couldn't find this table in the note.");
			return;
		}
		const next = change(current, action, this.settings);
		if (!(await ref.write(next))) {
			new Notice("The note changed. Try again.");
			return;
		}
		if (table) applyStyle(table, effective(next, this.settings), this.settings);
	}

	/** Alinha uma coluna gravando na linha separadora (:---, :---:, ---:). */
	async alignColumn(ref: TableRef | null, col: number, align: Align) {
		const delimiter = ref?.readDelimiter() ?? null;
		const next = delimiter === null ? null : setAlignment(delimiter, col, align);
		if (!ref || next === null) {
			new Notice("Couldn't find this table column in the note.");
			return;
		}
		if (next === delimiter) return;
		if (!(await ref.writeDelimiter(next))) new Notice("The note changed. Try again.");
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refresh();
	}

	/** Redesenha as tabelas abertas depois de mudar as configurações. */
	private refresh = debounce(
		() => {
			hideToolbar();
			for (const view of this.livePreviews) view.scan();
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view instanceof MarkdownView && leaf.view.getMode() === "preview") {
					leaf.view.previewMode.rerender(true);
				}
			});
		},
		300,
		true
	);
}
