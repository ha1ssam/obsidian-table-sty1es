import { EditorState, Line, RangeSetBuilder, StateField } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import type TableStylesPlugin from "./main";
import { ensureToolbar, removeToolbar, updateToolbar } from "./toolbar";
import { TableRef, applyStyle, effective, findMarker, formatMarker, markerBlock, parseMarker } from "./table-style";

/** No live preview, o Obsidian desenha cada tabela dentro deste elemento. */
const WIDGET = ".cm-table-widget";

export interface LivePreviewTables {
	scan(): void;
}

/** Esconde no live preview o marcador e a linha em branco abaixo dele. */
function hiddenMarkers(state: EditorState): DecorationSet {
	if (!state.field(editorLivePreviewField, false)) return Decoration.none;
	const builder = new RangeSetBuilder<Decoration>();
	const doc = state.doc;
	for (let n = 1; n <= doc.lines; n++) {
		const line = doc.line(n);
		if (!line.text.includes("table-style") || !parseMarker(line.text)) continue;
		const end = n < doc.lines && doc.line(n + 1).text.trim() === "" ? doc.line(n + 1) : line;
		// Com o cursor ali, mostra o texto para dar para editar.
		if (state.selection.ranges.some((r) => r.from <= end.to && r.to >= line.from)) continue;
		builder.add(line.from, end.to, Decoration.replace({ block: true }));
	}
	return builder.finish();
}

const hideMarkers = StateField.define<DecorationSet>({
	create: hiddenMarkers,
	update: (deco, tr) => {
		const modeChanged =
			tr.startState.field(editorLivePreviewField, false) !==
			tr.state.field(editorLivePreviewField, false);
		return tr.docChanged || tr.selection || modeChanged ? hiddenMarkers(tr.state) : deco;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export function livePreviewExtension(plugin: TableStylesPlugin) {
	return [hideMarkers, tablesPlugin(plugin)];
}

function tablesPlugin(plugin: TableStylesPlugin) {
	return ViewPlugin.fromClass(
		class implements PluginValue, LivePreviewTables {
			private observer: MutationObserver;
			private frame = 0;

			constructor(private readonly view: EditorView) {
				// O Obsidian troca o desenho da tabela sem avisar o editor,
				// então observamos o DOM e reaplicamos o estilo.
				this.observer = new MutationObserver(() => this.schedule());
				this.observer.observe(view.contentDOM, { childList: true, subtree: true });
				plugin.livePreviews.add(this);
				this.schedule();
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) this.schedule();
			}

			destroy() {
				this.observer.disconnect();
				if (this.frame) cancelAnimationFrame(this.frame);
				plugin.livePreviews.delete(this);
			}

			private schedule() {
				if (this.frame) return;
				this.frame = requestAnimationFrame(() => {
					this.frame = 0;
					this.scan();
				});
			}

			scan() {
				// Editores das células da tabela não são tratados.
				if (this.view.dom.parentElement?.closest(WIDGET)) return;
				const settings = plugin.settings;
				for (const widget of Array.from(
					this.view.contentDOM.querySelectorAll<HTMLElement>(WIDGET)
				)) {
					if (widget.parentElement?.closest(WIDGET)) continue;
					const table = widget.querySelector<HTMLElement>("table");
					const line = this.tableLine(widget);
					if (!table || !line) continue;
					applyStyle(table, effective(this.readMarker(line) ?? {}, settings), settings);
					if (settings.toolbar || settings.handles) {
						ensureToolbar(
							plugin,
							widget,
							() => widget.querySelector<HTMLTableElement>("table"),
							() => this.ref(widget)
						);
					} else {
						removeToolbar(widget);
					}
				}
				updateToolbar();
			}

			private tableLine(widget: HTMLElement): Line | null {
				// Tabela já redesenhada: a posição dela não vale mais.
				if (!widget.isConnected) return null;
				try {
					return this.view.state.doc.lineAt(this.view.posAtDOM(widget));
				} catch {
					return null;
				}
			}

			/** Linha do marcador (contando do 1), ou null. */
			private markerLine(table: Line): Line | null {
				const doc = this.view.state.doc;
				const n = findMarker((i) => doc.line(i + 1).text, table.number - 1);
				return n >= 0 ? doc.line(n + 1) : null;
			}

			private readMarker(table: Line) {
				const marker = this.markerLine(table);
				return marker ? parseMarker(marker.text) : null;
			}

			private ref(widget: HTMLElement): TableRef {
				return {
					read: () => {
						const line = this.tableLine(widget);
						return line ? this.readMarker(line) ?? {} : null;
					},
					write: (style) => {
						const line = this.tableLine(widget);
						if (!line) return false;
						const marker = this.markerLine(line);
						if (!marker && !formatMarker(style)) return true;
						const from = marker?.from ?? line.from;
						const doc = this.view.state.doc;
						const above = from > 0 ? doc.lineAt(from - 1).text : undefined;
						const insert = markerBlock(style, above).map((l) => `${l}\n`).join("");
						this.view.dispatch({ changes: { from, to: line.from, insert } });
						return true;
					},
					readDelimiter: () => {
						const line = this.tableLine(widget);
						const doc = this.view.state.doc;
						return line && line.number < doc.lines ? doc.line(line.number + 1).text : null;
					},
					writeDelimiter: (text) => {
						const line = this.tableLine(widget);
						const doc = this.view.state.doc;
						if (!line || line.number >= doc.lines) return false;
						const delimiter = doc.line(line.number + 1);
						this.view.dispatch({ changes: { from: delimiter.from, to: delimiter.to, insert: text } });
						return true;
					},
				};
			}
		}
	);
}
