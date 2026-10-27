import { Menu, setIcon } from "obsidian";
import type TableStylesPlugin from "./main";
import { COLORS, COLOR_NAMES, TableAction, TableRef, effective } from "./table-style";

const TOOLBAR = "ts-toolbar";

function findToolbar(host: HTMLElement): HTMLElement | null {
	return host.querySelector<HTMLElement>(`:scope > .${TOOLBAR}`);
}

export function removeToolbar(host: HTMLElement) {
	findToolbar(host)?.remove();
}

/**
 * Coloca a barrinha (menor, maior, listras, cores, largura, padrão) no canto
 * da tabela. Ela aparece ao passar o mouse ou tocar na tabela.
 */
export function ensureToolbar(
	plugin: TableStylesPlugin,
	host: HTMLElement,
	getTable: () => HTMLElement | null,
	getRef: () => TableRef | null
) {
	host.addClass("ts-host");
	if (findToolbar(host)) return;

	const bar = host.createDiv({ cls: TOOLBAR });
	// Não deixa o clique chegar no editor de tabela do Obsidian.
	for (const type of ["mousedown", "pointerdown", "touchstart"]) {
		bar.addEventListener(type, (evt) => evt.stopPropagation());
	}
	bar.addEventListener("mousedown", (evt) => evt.preventDefault());

	const run = (action: TableAction) => {
		void plugin.runAction(getRef(), getTable(), action);
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
	};

	button("minus", "Smaller table", () => run({ type: "smaller" }));
	button("plus", "Bigger table", () => run({ type: "bigger" }));
	button("align-justify", "Toggle stripes", () => run({ type: "stripes" }));
	button("palette", "Colors", (evt) => openColorMenu(plugin, evt, getRef(), run));
	button("move-horizontal", "Toggle full width", () => run({ type: "width" }));
	button("rotate-ccw", "Reset table style", () => run({ type: "reset" }));
}

function openColorMenu(
	plugin: TableStylesPlugin,
	evt: MouseEvent,
	ref: TableRef | null,
	run: (action: TableAction) => void
) {
	const eff = effective(ref?.read() ?? {}, plugin.settings);
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
