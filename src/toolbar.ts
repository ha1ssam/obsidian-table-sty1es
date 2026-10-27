import { Menu, setIcon } from "obsidian";
import type TableStylesPlugin from "./main";
import { COLORS, COLOR_NAMES, TableAction, TableRef, effective } from "./table-style";

/**
 * A barra flutua sobre a nota, presa no corpo da página, logo acima da
 * tabela. Assim ela não é cortada pela caixa da tabela nem cobre as células.
 * Aparece ao apontar o mouse ou tocar na tabela.
 */

interface Target {
	plugin: TableStylesPlugin;
	getTable: () => HTMLElement | null;
	getRef: () => TableRef | null;
}

interface Shown {
	host: HTMLElement;
	/** Onde a tabela estava, para achá-la de novo se for redesenhada. */
	lastRect: DOMRect | null;
	bar: HTMLElement;
	size: HTMLElement;
	cleanup: () => void;
}

const HIDE_DELAY = 300;
const GAP = 6;

const targets = new WeakMap<HTMLElement, Target>();
const bound = new WeakSet<HTMLElement>();
let shown: Shown | null = null;
let hideTimer = 0;

/** Liga a barra a uma tabela. `host` é o elemento que recebe o mouse. */
export function ensureToolbar(
	plugin: TableStylesPlugin,
	host: HTMLElement,
	getTable: () => HTMLElement | null,
	getRef: () => TableRef | null
) {
	targets.set(host, { plugin, getTable, getRef });
	// A tabela foi redesenhada enquanto a barra estava aberta.
	if (shown && !shown.host.isConnected) updateToolbar();
	if (bound.has(host)) return;
	bound.add(host);
	host.addEventListener("pointerenter", () => show(host));
	host.addEventListener("pointerdown", () => show(host));
	host.addEventListener("pointerleave", (evt) => {
		if (evt.pointerType !== "touch") scheduleHide();
	});
}

export function removeToolbar(host: HTMLElement) {
	targets.delete(host);
	if (shown?.host === host) hideToolbar();
}

/** Reposiciona a barra, ou some com ela se a tabela saiu da tela. */
export function updateToolbar() {
	if (!shown) return;
	if (!shown.host.isConnected) {
		const replacement = findReplacement(shown);
		if (!replacement) {
			// A tabela nova ainda não foi desenhada: espera um pouco antes de sumir.
			shown.bar.addClass("is-offscreen");
			scheduleHide();
			return;
		}
		shown.host = replacement;
		window.clearTimeout(hideTimer);
	}
	const target = targets.get(shown.host);
	const table = target?.getTable();
	if (!target || !table || !shown.host.isConnected) {
		hideToolbar();
		return;
	}
	const { bar, size } = shown;
	const win = bar.win;
	const style = effective(target.getRef()?.read() ?? {}, target.plugin.settings);
	size.setText(`${style.size}%`);

	const rect = table.getBoundingClientRect();
	shown.lastRect = rect;
	const barRect = bar.getBoundingClientRect();
	let top = rect.top - barRect.height - GAP;
	if (top < GAP) top = rect.bottom + GAP;
	const right = Math.min(rect.right, win.innerWidth - GAP);
	const left = Math.max(GAP, right - barRect.width);
	bar.toggleClass("is-offscreen", rect.bottom < 0 || rect.top > win.innerHeight);
	bar.setCssProps({ top: `${top}px`, left: `${left}px` });
}

/** A tabela nova que ficou no lugar da antiga, depois de a nota mudar. */
function findReplacement(current: Shown): HTMLElement | null {
	const rect = current.lastRect;
	if (!rect) return null;
	const x = rect.left + Math.min(rect.width / 2, 20);
	const y = rect.top + Math.min(rect.height / 2, 10);
	let el = current.bar.doc.elementFromPoint(x, y);
	while (el && !(el instanceof HTMLElement && targets.has(el))) el = el.parentElement;
	return el as HTMLElement | null;
}

export function hideToolbar() {
	window.clearTimeout(hideTimer);
	shown?.cleanup();
	shown = null;
}

function scheduleHide() {
	window.clearTimeout(hideTimer);
	hideTimer = window.setTimeout(hideToolbar, HIDE_DELAY);
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

	const doc = host.doc;
	const win = host.win;
	const bar = doc.body.createDiv({ cls: "ts-toolbar" });
	bar.addEventListener("pointerenter", () => window.clearTimeout(hideTimer));
	bar.addEventListener("pointerleave", (evt) => {
		if (evt.pointerType !== "touch") scheduleHide();
	});
	// Mantém o cursor no editor ao clicar nos botões.
	bar.addEventListener("mousedown", (evt) => evt.preventDefault());

	const run = (action: TableAction, on: HTMLElement = shown?.host ?? host) => {
		const t = targets.get(on);
		if (!t) return;
		void t.plugin.runAction(t.getRef(), t.getTable(), action).then(updateToolbar);
	};

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

	button("minus", "Smaller table", () => run({ type: "smaller" }));
	const size = bar.createSpan({ cls: "ts-size" });
	button("plus", "Bigger table", () => run({ type: "bigger" }));
	button("align-justify", "Toggle stripes", () => run({ type: "stripes" }));
	button("palette", "Colors", (evt) => {
		// O menu fica aberto depois que a barra some: guarda a tabela de agora.
		const on = shown?.host ?? host;
		const t = targets.get(on);
		if (t) openColorMenu(t, evt, (action) => run(action, on));
	});
	button("move-horizontal", "Toggle full width", () => run({ type: "width" }));
	button("rotate-ccw", "Reset table style", () => run({ type: "reset" }));

	const onScroll = () => updateToolbar();
	// Num toque fora da tabela e da barra, a barra some.
	const onPointerDown = (evt: PointerEvent) => {
		const node = evt.target as Node;
		const current = shown?.host ?? host;
		if (!current.contains(node) && !bar.contains(node)) hideToolbar();
	};
	doc.addEventListener("scroll", onScroll, true);
	win.addEventListener("resize", onScroll);
	doc.addEventListener("pointerdown", onPointerDown, true);

	shown = {
		host,
		lastRect: null,
		bar,
		size,
		cleanup: () => {
			doc.removeEventListener("scroll", onScroll, true);
			win.removeEventListener("resize", onScroll);
			doc.removeEventListener("pointerdown", onPointerDown, true);
			bar.remove();
		},
	};
	updateToolbar();
}

function openColorMenu(target: Target, evt: MouseEvent, run: (action: TableAction) => void) {
	const eff = effective(target.getRef()?.read() ?? {}, target.plugin.settings);
	const menu = new Menu();
	for (const color of COLORS) {
		menu.addItem((item) =>
			item
				.setTitle(`${COLOR_NAMES[color]} stripes`)
				.setChecked(eff.stripes && eff.color === color)
				.onClick(() => run({ type: "color", color }))
		);
	}
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle("No header color")
			.setChecked(eff.header === "none")
			.onClick(() => run({ type: "header", header: "none" }))
	);
	for (const color of COLORS) {
		menu.addItem((item) =>
			item
				.setTitle(`${COLOR_NAMES[color]} header`)
				.setChecked(eff.header === color)
				.onClick(() => run({ type: "header", header: color }))
		);
	}
	menu.showAtMouseEvent(evt);
}
