import { MIN_COL_EM, applySize } from "./table-style";

/**
 * Alças para redimensionar a tabela arrastando: canto inferior direito
 * (largura e altura), borda direita (largura), borda de baixo (altura) e a
 * borda entre os cabeçalhos (uma coluna). Usam pointer events, então
 * funcionam com mouse e com toque. Duplo clique volta ao tamanho automático.
 */

export interface ResizeContext {
	getTable(): HTMLTableElement | null;
	/** Largura máxima: a largura do editor. */
	maxWidth(): number;
	/** Tamanho gravado agora, para manter o que o arraste não muda. */
	current(): { cols: number[] | null; h: number | null };
	commit(cols: number[] | null, h: number | null): void;
	onDragChange(dragging: boolean): void;
}

type Kind = "corner" | "right" | "bottom" | number;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export class ResizeHandles {
	readonly el: HTMLElement;
	private cols: HTMLElement[] = [];
	private dragging = false;

	constructor(parent: HTMLElement, private readonly ctx: ResizeContext) {
		this.el = parent.createDiv({ cls: "ts-handles" });
		this.grip("ts-grip-right", "right", "Drag to change the width. Double-click for automatic size.");
		this.grip("ts-grip-bottom", "bottom", "Drag to change the height. Double-click for automatic size.");
		this.grip("ts-grip-corner", "corner", "Drag to resize the table. Double-click for automatic size.");
	}

	/** Coloca as alças sobre a tabela. */
	layout(table: HTMLTableElement, rect: DOMRect) {
		this.el.setCssProps({
			left: `${rect.left}px`,
			top: `${rect.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
		});
		// Durante o arraste a alça não pode ser trocada: perderia o ponteiro.
		if (this.dragging) return;
		const header = table.rows[0];
		const cells = header ? Array.from(header.cells) : [];
		const count = Math.max(0, cells.length - 1);
		while (this.cols.length > count) this.cols.pop()?.remove();
		while (this.cols.length < count) {
			this.cols.push(
				this.grip("ts-grip-col", this.cols.length, "Drag to change this column's width. Double-click for automatic size.")
			);
		}
		const headerHeight = header?.getBoundingClientRect().height ?? 0;
		cells.slice(0, count).forEach((cell, i) => {
			const x = cell.getBoundingClientRect().right - rect.left;
			this.cols[i].setCssProps({ left: `${x}px`, height: `${headerHeight}px` });
		});
	}

	private grip(cls: string, kind: Kind, label: string): HTMLElement {
		const el = this.el.createDiv({ cls: `ts-grip ${cls}`, attr: { "aria-label": label } });
		el.addEventListener("pointerdown", (evt) => this.start(evt, el, kind));
		el.addEventListener("dblclick", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.ctx.commit(null, null);
		});
		// Não deixa o clique chegar no editor de tabela do Obsidian.
		el.addEventListener("mousedown", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
		});
		return el;
	}

	private start(evt: PointerEvent, grip: HTMLElement, kind: Kind) {
		if (evt.button !== 0) return;
		const table = this.ctx.getTable();
		const header = table?.rows[0];
		if (!table || !header || !header.cells.length) return;
		evt.preventDefault();
		evt.stopPropagation();
		grip.setPointerCapture(evt.pointerId);

		const start = Array.from(header.cells).map((c) => c.getBoundingClientRect().width);
		const startWidth = sum(start);
		const startHeight = table.getBoundingClientRect().height;
		const fontSize = parseFloat(getComputedStyle(header.cells[0]).fontSize) || 16;
		const minCol = fontSize * MIN_COL_EM;
		const maxWidth = Math.max(this.ctx.maxWidth(), start.length * minCol);
		const minHeight = table.rows.length * fontSize * 1.2;
		const saved = this.ctx.current();
		const x0 = evt.clientX;
		const y0 = evt.clientY;
		let cols = saved.cols;
		let h = saved.h;
		let moved = false;

		this.dragging = true;
		this.ctx.onDragChange(true);
		grip.addClass("is-active");
		table.addClass("ts-resizing");

		const move = (e: PointerEvent) => {
			if (e.pointerId !== evt.pointerId) return;
			const dx = e.clientX - x0;
			const dy = e.clientY - y0;
			if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
			moved = true;
			if (kind === "corner" || kind === "right") {
				const target = Math.min(maxWidth, Math.max(start.length * minCol, startWidth + dx));
				const factor = target / startWidth;
				cols = start.map((w) => Math.max(minCol, w * factor));
			} else if (typeof kind === "number") {
				cols = start.slice();
				const others = startWidth - start[kind];
				cols[kind] = Math.min(maxWidth - others, Math.max(minCol, start[kind] + dx));
			}
			if (kind === "corner" || kind === "bottom") {
				h = Math.max(minHeight, startHeight + dy);
			}
			table.removeClass("ts-full");
			applySize(table, cols, h);
		};

		const end = (e: PointerEvent) => {
			if (e.pointerId !== evt.pointerId) return;
			grip.removeEventListener("pointermove", move);
			grip.removeEventListener("pointerup", end);
			grip.removeEventListener("pointercancel", end);
			grip.removeClass("is-active");
			table.removeClass("ts-resizing");
			this.dragging = false;
			this.ctx.onDragChange(false);
			if (moved && e.type === "pointerup") this.ctx.commit(cols, h);
			else applySize(table, saved.cols, saved.h);
		};

		grip.addEventListener("pointermove", move);
		grip.addEventListener("pointerup", end);
		grip.addEventListener("pointercancel", end);
	}

	remove() {
		this.el.remove();
	}
}
