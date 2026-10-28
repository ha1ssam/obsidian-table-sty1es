import { Menu, setIcon } from "obsidian";
import { ColorsModal } from "./colors-modal";
import type TableStylesPlugin from "./main";
import { ResizeHandles } from "./resize";
import {
	ALIGN_NAMES,
	Align,
	PRESETS,
	TableAction,
	TableRef,
	effective,
	getAlignment,
} from "./table-style";

/**
 * Uma camada flutua sobre a nota, presa no corpo da página: a barra logo
 * acima da tabela e as alças de redimensionar sobre as bordas dela. Assim
 * nada é cortado pela caixa da tabela nem cobre as células. Aparece ao
 * apontar o mouse ou tocar na tabela.
 */

interface Target {
	plugin: TableStylesPlugin;
	getTable: () => HTMLTableElement | null;
	getRef: () => TableRef | null;
}

interface Shown {
	host: HTMLElement;
	/** Onde a tabela estava, para achá-la de novo se for redesenhada. */
	lastRect: DOMRect | null;
	bar: HTMLElement | null;
	size: HTMLElement | null;
	align: Map<Align, HTMLElement>;
	handles: ResizeHandles | null;
	dragging: boolean;
	cleanup: () => void;
}

const HIDE_DELAY = 300;
/** Quanto uma tabela redesenhada pode ter andado para ainda ser a mesma. */
const MAX_JUMP = 160;
const GAP = 6;
const ALIGN_ICONS: Record<Align, string> = {
	left: "align-left",
	center: "align-center",
	right: "align-right",
};

const targets = new WeakMap<HTMLElement, Target>();
const bound = new WeakSet<HTMLElement>();
/** A última coluna apontada ou tocada em cada tabela. */
const lastColumn = new WeakMap<HTMLElement, number>();
let shown: Shown | null = null;
let hideTimer = 0;

/** Liga a barra e as alças a uma tabela. `host` é o elemento que recebe o mouse. */
export function ensureToolbar(
	plugin: TableStylesPlugin,
	host: HTMLElement,
	getTable: () => HTMLTableElement | null,
	getRef: () => TableRef | null
) {
	targets.set(host, { plugin, getTable, getRef });
	host.addClass("ts-host");
	// A tabela foi redesenhada enquanto a barra estava aberta.
	if (shown && !shown.host.isConnected) updateToolbar();
	if (bound.has(host)) return;
	bound.add(host);
	host.addEventListener("pointerenter", () => show(host));
	host.addEventListener("pointerdown", (evt) => {
		trackColumn(host, evt);
		show(host);
	});
	host.addEventListener("pointermove", (evt) => trackColumn(host, evt));
	host.addEventListener("pointerleave", (evt) => {
		if (evt.pointerType !== "touch") scheduleHide();
	});
}

export function removeToolbar(host: HTMLElement) {
	targets.delete(host);
	host.removeClass("ts-host");
	if (shown?.host === host) hideToolbar();
}

/** A coluna que os botões de alinhamento vão mudar nesta tabela. */
export function activeColumn(host: HTMLElement): number {
	return lastColumn.get(host) ?? 0;
}

function trackColumn(host: HTMLElement, evt: PointerEvent) {
	const cell = (evt.target as HTMLElement | null)?.closest?.("td, th");
	const table = targets.get(host)?.getTable();
	if (!(cell instanceof HTMLTableCellElement) || !table?.contains(cell)) return;
	if (lastColumn.get(host) === cell.cellIndex) return;
	lastColumn.set(host, cell.cellIndex);
	if (shown?.host === host) updateAlignButtons();
}

/** Reposiciona a camada, ou some com ela se a tabela saiu da tela. */
export function updateToolbar() {
	if (!shown) return;
	if (!shown.host.isConnected) {
		const replacement = findReplacement(shown);
		if (!replacement) {
			// A tabela nova ainda não foi desenhada: espera um pouco antes de sumir.
			shown.bar?.addClass("is-offscreen");
			shown.handles?.el.addClass("is-offscreen");
			scheduleHide();
			return;
		}
		if (lastColumn.has(shown.host)) lastColumn.set(replacement, activeColumn(shown.host));
		shown.host = replacement;
		window.clearTimeout(hideTimer);
	}
	const target = targets.get(shown.host);
	const table = target?.getTable();
	if (!target || !table || !shown.host.isConnected) {
		hideToolbar();
		return;
	}
	const win = shown.host.win;
	const rect = table.getBoundingClientRect();
	shown.lastRect = rect;
	const offscreen = rect.bottom < 0 || rect.top > win.innerHeight;

	const { bar, size, handles } = shown;
	if (bar && size) {
		const style = effective(target.getRef()?.read() ?? {}, target.plugin.settings);
		size.setText(`${style.size}%`);
		updateAlignButtons();
		const barRect = bar.getBoundingClientRect();
		let top = rect.top - barRect.height - GAP;
		if (top < GAP) top = rect.bottom + GAP;
		const right = Math.min(rect.right, win.innerWidth - GAP);
		const left = Math.max(GAP, right - barRect.width);
		bar.toggleClass("is-offscreen", offscreen);
		bar.setCssProps({ top: `${top}px`, left: `${left}px` });
	}
	if (handles) {
		handles.el.toggleClass("is-offscreen", offscreen);
		handles.layout(table, rect);
	}
}

/** Marca o botão do alinhamento atual e diz qual coluna vai mudar. */
function updateAlignButtons() {
	if (!shown) return;
	const ref = targets.get(shown.host)?.getRef();
	const col = activeColumn(shown.host);
	const current = getAlignment(ref?.readDelimiter() ?? "", col) ?? "left";
	for (const [align, el] of shown.align) {
		el.toggleClass("is-active", align === current);
		el.setAttr("aria-label", `Align column ${col + 1}: ${ALIGN_NAMES[align].toLowerCase()}`);
	}
}

/** A tabela nova que ficou no lugar da antiga, depois de a nota mudar. */
function findReplacement(current: Shown): HTMLElement | null {
	const rect = current.lastRect;
	if (!rect) return null;
	const x = rect.left + Math.min(rect.width / 2, 20);
	const y = rect.top + Math.min(rect.height / 2, 10);
	let el = current.host.doc.elementFromPoint(x, y);
	while (el && !(el instanceof HTMLElement && targets.has(el))) el = el.parentElement;
	if (el) return el as HTMLElement;
	// A tabela andou um pouco (uma linha entrou acima dela): pega a mais próxima.
	let best: HTMLElement | null = null;
	let bestDistance = MAX_JUMP;
	for (const host of Array.from(current.host.doc.querySelectorAll<HTMLElement>(".ts-host"))) {
		const table = targets.get(host)?.getTable();
		if (!table) continue;
		const r = table.getBoundingClientRect();
		const distance = Math.abs(r.top - rect.top) + Math.abs(r.left - rect.left);
		if (distance < bestDistance) {
			best = host;
			bestDistance = distance;
		}
	}
	return best;
}

export function hideToolbar() {
	window.clearTimeout(hideTimer);
	shown?.cleanup();
	shown = null;
}

function scheduleHide() {
	window.clearTimeout(hideTimer);
	// Durante um arraste a camada fica, mesmo com o ponteiro fora da tabela.
	if (shown?.dragging) return;
	hideTimer = window.setTimeout(hideToolbar, HIDE_DELAY);
}

/** Mostra a coluna que vai mudar enquanto o ponteiro está num botão de alinhamento. */
function highlightColumn(on: boolean) {
	const table = shown ? targets.get(shown.host)?.getTable() : null;
	if (!shown || !table) return;
	const col = activeColumn(shown.host);
	for (const row of Array.from(table.rows)) {
		for (const cell of Array.from(row.cells)) {
			cell.toggleClass("ts-col-target", on && cell.cellIndex === col);
		}
	}
}

function show(host: HTMLElement) {
	const target = targets.get(host);
	if (!target) return;
	window.clearTimeout(hideTimer);
	if (shown?.host === host) {
		updateToolbar();
		return;
	}
	hideToolbar();

	const { plugin } = target;
	const doc = host.doc;
	const win = host.win;
	const keepOpen = (el: HTMLElement) => {
		el.addEventListener("pointerenter", () => window.clearTimeout(hideTimer));
		el.addEventListener("pointerleave", (evt) => {
			if (evt.pointerType !== "touch") scheduleHide();
		});
	};

	const current: Shown = {
		host,
		lastRect: null,
		bar: null,
		size: null,
		align: new Map(),
		handles: null,
		dragging: false,
		cleanup: () => {},
	};
	const hostNow = () => shown?.host ?? host;
	const targetNow = () => targets.get(hostNow());

	const run = (action: TableAction, on: HTMLElement = hostNow()) => {
		const t = targets.get(on);
		if (!t) return;
		void t.plugin.runAction(t.getRef(), t.getTable(), action).then(updateToolbar);
	};

	if (plugin.settings.toolbar) {
		const bar = doc.body.createDiv({ cls: "ts-toolbar" });
		keepOpen(bar);
		// Mantém o cursor no editor ao clicar nos botões.
		bar.addEventListener("mousedown", (evt) => evt.preventDefault());

		const button = (icon: string, label: string, onClick: (evt: MouseEvent) => void) => {
			const el = bar.createEl("button", {
				cls: "clickable-icon ts-button",
				attr: { "aria-label": label },
			});
			setIcon(el, icon);
			el.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				onClick(evt);
			});
			return el;
		};
		const divider = () => bar.createDiv({ cls: "ts-divider" });

		button("minus", "Smaller table", () => run({ type: "smaller" }));
		current.size = bar.createSpan({ cls: "ts-size" });
		button("plus", "Bigger table", () => run({ type: "bigger" }));
		divider();
		button("palette", "Colors", (evt) => {
			// O menu fica aberto depois que a barra some: guarda a tabela de agora.
			const on = hostNow();
			const t = targets.get(on);
			if (t) openColorMenu(t, evt, (action) => run(action, on));
		});
		divider();
		for (const align of ["left", "center", "right"] as Align[]) {
			const el = button(ALIGN_ICONS[align], `Align column: ${ALIGN_NAMES[align].toLowerCase()}`, () => {
				const t = targetNow();
				if (!t) return;
				void t.plugin
					.alignColumn(t.getRef(), activeColumn(hostNow()), align)
					.then(updateToolbar);
			});
			el.addEventListener("pointerenter", () => highlightColumn(true));
			el.addEventListener("pointerleave", () => highlightColumn(false));
			current.align.set(align, el);
		}
		divider();
		button("move-horizontal", "Toggle full width", () => run({ type: "width" }));
		button("rotate-ccw", "Reset table style", () => run({ type: "reset" }));
		current.bar = bar;
	}

	if (plugin.settings.handles) {
		current.handles = new ResizeHandles(doc.body, {
			getTable: () => targetNow()?.getTable() ?? null,
			maxWidth: () => editorWidth(hostNow()),
			current: () => {
				const t = targetNow();
				const style = effective(t?.getRef()?.read() ?? {}, plugin.settings);
				return { cols: style.cols, h: style.h };
			},
			commit: (cols, h) => run({ type: "resize", cols, h }),
			onDragChange: (dragging) => {
				current.dragging = dragging;
				if (dragging) window.clearTimeout(hideTimer);
			},
		});
		for (const grip of Array.from(current.handles.el.children)) keepOpen(grip as HTMLElement);
		// As alças das colunas são criadas depois: o evento sobe até a camada.
		current.handles.el.addEventListener("pointerover", () => window.clearTimeout(hideTimer));
		current.handles.el.addEventListener("pointerout", (evt) => {
			if (evt.pointerType !== "touch") scheduleHide();
		});
	}

	const onScroll = () => updateToolbar();
	// Num toque fora da tabela e da camada, ela some.
	const onPointerDown = (evt: PointerEvent) => {
		const node = evt.target as Node;
		const inside =
			hostNow().contains(node) ||
			!!current.bar?.contains(node) ||
			!!current.handles?.el.contains(node);
		if (!inside) hideToolbar();
	};
	doc.addEventListener("scroll", onScroll, true);
	win.addEventListener("resize", onScroll);
	doc.addEventListener("pointerdown", onPointerDown, true);

	current.cleanup = () => {
		doc.removeEventListener("scroll", onScroll, true);
		win.removeEventListener("resize", onScroll);
		doc.removeEventListener("pointerdown", onPointerDown, true);
		highlightColumn(false);
		current.bar?.remove();
		current.handles?.remove();
	};
	shown = current;
	updateToolbar();
}

/** Largura útil do editor em volta da tabela, sem as margens internas. */
function editorWidth(host: HTMLElement): number {
	const style = getComputedStyle(host);
	const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
	return host.clientWidth - padding;
}

function openColorMenu(target: Target, evt: MouseEvent, run: (action: TableAction) => void) {
	const eff = effective(target.getRef()?.read() ?? {}, target.plugin.settings);
	const menu = new Menu();
	for (const preset of PRESETS) {
		menu.addItem((item) =>
			item
				.setTitle(preset.name)
				.setChecked(eff.colors && eff.c1 === preset.c1 && eff.c2 === preset.c2)
				.onClick(() => run({ type: "colors", c1: preset.c1, c2: preset.c2 }))
		);
	}
	menu.addItem((item) =>
		item
			.setTitle("Custom colors…")
			.setIcon("pipette")
			.onClick(() => {
				new ColorsModal(target.plugin.app, { c1: eff.c1, c2: eff.c2 }, (c) =>
					run({ type: "colors", c1: c.c1, c2: c.c2 })
				).open();
			})
	);
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle("Reset colors")
			.setIcon("rotate-ccw")
			.onClick(() => run({ type: "reset-colors" }))
	);
	menu.addItem((item) =>
		item
			.setTitle("Default style (no color)")
			.setChecked(!eff.colors)
			.onClick(() => run({ type: "no-colors" }))
	);
	menu.showAtMouseEvent(evt);
}
