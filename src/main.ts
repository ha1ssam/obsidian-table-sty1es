import { Editor, MarkdownView, Notice, Plugin, debounce } from "obsidian";
import { LivePreviewTables, livePreviewExtension } from "./live-preview";
import { registerReadingView } from "./reading-view";
import { TableStylesSettingTab } from "./settings";
import { hideToolbar } from "./toolbar";
import {
	DEFAULT_SETTINGS,
	TableAction,
	TableRef,
	TableStylesSettings,
	applyStyle,
	change,
	effective,
	findMarker,
	formatMarker,
	markerBlock,
	parseMarker,
} from "./table-style";

const DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** A tabela onde está o cursor, no modo de edição. */
function editorRef(editor: Editor): TableRef | null {
	const isTableLine = (n: number) => editor.getLine(n).includes("|");
	let start = editor.getCursor().line;
	if (!isTableLine(start)) return null;
	while (start > 0 && isTableLine(start - 1)) start--;
	if (start + 1 >= editor.lineCount() || !DELIMITER_ROW.test(editor.getLine(start + 1))) {
		return null;
	}
	const marker = () => findMarker((n) => editor.getLine(n), start);
	return {
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
	};
}

export default class TableStylesPlugin extends Plugin {
	settings: TableStylesSettings = { ...DEFAULT_SETTINGS };
	readonly livePreviews = new Set<LivePreviewTables>();

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.addSettingTab(new TableStylesSettingTab(this.app, this));
		registerReadingView(this);
		this.registerEditorExtension(livePreviewExtension(this));

		const commands: [string, string, TableAction][] = [
			["bigger", "Make table bigger", { type: "bigger" }],
			["smaller", "Make table smaller", { type: "smaller" }],
			["stripes", "Toggle table stripes", { type: "stripes" }],
			["width", "Toggle table full width", { type: "width" }],
			["reset", "Reset table style", { type: "reset" }],
		];
		for (const [id, name, action] of commands) {
			this.addCommand({
				id,
				name,
				editorCheckCallback: (checking, editor) => {
					const ref = editorRef(editor);
					if (checking) return ref !== null;
					void this.runAction(ref, null, action);
					return true;
				},
			});
		}
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

	async saveSettings() {
		await this.saveData(this.settings);
		this.refresh();
	}

	/** Redesenha as tabelas abertas depois de mudar as configurações. */
	private refresh = debounce(
		() => {
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
