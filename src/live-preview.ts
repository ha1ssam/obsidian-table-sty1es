import { Line } from "@codemirror/state";
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type TableStylesPlugin from "./main";
import { ensureToolbar, removeToolbar } from "./toolbar";
import { TableRef, applyStyle, effective, formatMarker, parseMarker } from "./table-style";

/** No live preview, o Obsidian desenha cada tabela dentro deste elemento. */
const WIDGET = ".cm-table-widget";

export interface LivePreviewTables {
	scan(): void;
}

export function livePreviewExtension(plugin: TableStylesPlugin) {
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
				const doc = this.view.state.doc;
				const settings = plugin.settings;
				for (const widget of Array.from(
					this.view.contentDOM.querySelectorAll<HTMLElement>(WIDGET)
				)) {
					if (widget.parentElement?.closest(WIDGET)) continue;
					const table = widget.querySelector<HTMLElement>("table");
					const line = this.tableLine(widget);
					if (!table || !line) continue;
					const marker = line.number > 1 ? parseMarker(doc.line(line.number - 1).text) : null;
					applyStyle(table, effective(marker ?? {}, settings), settings);
					if (settings.toolbar) {
						ensureToolbar(
							plugin,
							widget,
							() => widget.querySelector<HTMLElement>("table"),
							() => this.ref(widget)
						);
					} else {
						removeToolbar(widget);
					}
				}
			}

			private tableLine(widget: HTMLElement): Line | null {
				try {
					return this.view.state.doc.lineAt(this.view.posAtDOM(widget));
				} catch {
					return null;
				}
			}

			private ref(widget: HTMLElement): TableRef {
				return {
					read: () => {
						const line = this.tableLine(widget);
						if (!line) return null;
						if (line.number === 1) return {};
						return parseMarker(this.view.state.doc.line(line.number - 1).text) ?? {};
					},
					write: (style) => {
						const line = this.tableLine(widget);
						if (!line) return false;
						const doc = this.view.state.doc;
						const prev = line.number > 1 ? doc.line(line.number - 1) : null;
						const text = formatMarker(style);
						if (prev && parseMarker(prev.text)) {
							this.view.dispatch({
								changes: text
									? { from: prev.from, to: prev.to, insert: text }
									: { from: prev.from, to: line.from, insert: "" },
							});
						} else if (text) {
							this.view.dispatch({ changes: { from: line.from, insert: `${text}\n` } });
						}
						return true;
					},
				};
			}
		}
	);
}
