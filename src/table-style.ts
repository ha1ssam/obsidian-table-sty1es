// Modelo do estilo de cada tabela e o marcador que o guarda na nota.
// O marcador é um comentário HTML logo acima da tabela, por exemplo:
//   <!-- table-style: size=120 stripes=on color=blue header=blue width=full -->
// Só aparecem as opções que diferem do padrão das configurações.

export const COLORS = [
	"gray",
	"accent",
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
] as const;
export type ColorId = (typeof COLORS)[number];
export type HeaderColor = ColorId | "none";
export type Width = "auto" | "full";

export const COLOR_NAMES: Record<ColorId, string> = {
	gray: "Gray",
	accent: "Accent",
	red: "Red",
	orange: "Orange",
	yellow: "Yellow",
	green: "Green",
	cyan: "Cyan",
	blue: "Blue",
	purple: "Purple",
	pink: "Pink",
};

const COLOR_VARS: Record<ColorId, string> = {
	gray: "var(--text-normal)",
	accent: "var(--color-accent)",
	red: "var(--color-red)",
	orange: "var(--color-orange)",
	yellow: "var(--color-yellow)",
	green: "var(--color-green)",
	cyan: "var(--color-cyan)",
	blue: "var(--color-blue)",
	purple: "var(--color-purple)",
	pink: "var(--color-pink)",
};

export const MIN_SIZE = 50;
export const MAX_SIZE = 250;

/** Opções guardadas no marcador. O que falta vem das configurações. */
export interface TableStyle {
	size?: number;
	stripes?: boolean;
	color?: ColorId;
	header?: HeaderColor;
	width?: Width;
}

export type EffectiveStyle = Required<TableStyle>;

export interface TableStylesSettings {
	size: number;
	stripes: boolean;
	color: ColorId;
	header: HeaderColor;
	width: Width;
	/** Força da cor das listras, em %. */
	intensity: number;
	hover: boolean;
	/** Quanto o tamanho muda a cada clique, em pontos percentuais. */
	step: number;
	toolbar: boolean;
}

export const DEFAULT_SETTINGS: TableStylesSettings = {
	size: 100,
	stripes: true,
	color: "gray",
	header: "none",
	width: "auto",
	intensity: 8,
	hover: true,
	step: 10,
	toolbar: true,
};

export type TableAction =
	| { type: "bigger" }
	| { type: "smaller" }
	| { type: "stripes" }
	| { type: "width" }
	| { type: "color"; color: ColorId }
	| { type: "header"; header: HeaderColor }
	| { type: "reset" };

const MARKER = /^\s*<!--\s*table-style:?(.*?)-->\s*$/;

export function isColor(value: string | undefined): value is ColorId {
	return (COLORS as readonly string[]).includes(value ?? "");
}

const clampSize = (n: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));

/** Lê um marcador. Devolve null se a linha não for um marcador. */
export function parseMarker(line: string | undefined): TableStyle | null {
	const match = MARKER.exec(line ?? "");
	if (!match) return null;
	const style: TableStyle = {};
	for (const token of match[1].trim().split(/\s+/)) {
		const [key, value] = token.split("=");
		switch (key) {
			case "size": {
				const n = parseInt(value ?? "", 10);
				if (!isNaN(n)) style.size = clampSize(n);
				break;
			}
			case "stripes":
				if (value === "on" || value === "off") style.stripes = value === "on";
				break;
			case "color":
				if (isColor(value)) style.color = value;
				break;
			case "header":
				if (value === "none" || isColor(value)) style.header = value;
				break;
			case "width":
				if (value === "auto" || value === "full") style.width = value;
				break;
		}
	}
	return style;
}

/** Monta o marcador. Devolve null quando não há nada a guardar. */
export function formatMarker(style: TableStyle): string | null {
	const parts: string[] = [];
	if (style.size !== undefined) parts.push(`size=${style.size}`);
	if (style.stripes !== undefined) parts.push(`stripes=${style.stripes ? "on" : "off"}`);
	if (style.color !== undefined) parts.push(`color=${style.color}`);
	if (style.header !== undefined) parts.push(`header=${style.header}`);
	if (style.width !== undefined) parts.push(`width=${style.width}`);
	return parts.length ? `<!-- table-style: ${parts.join(" ")} -->` : null;
}

export function effective(style: TableStyle, s: TableStylesSettings): EffectiveStyle {
	return {
		size: style.size ?? s.size,
		stripes: style.stripes ?? s.stripes,
		color: style.color ?? s.color,
		header: style.header ?? s.header,
		width: style.width ?? s.width,
	};
}

/** Aplica uma ação e tira do resultado o que ficou igual ao padrão. */
export function change(
	style: TableStyle,
	action: TableAction,
	s: TableStylesSettings
): TableStyle {
	const eff = effective(style, s);
	const next: TableStyle = { ...style };
	switch (action.type) {
		case "bigger":
			next.size = clampSize(eff.size + s.step);
			break;
		case "smaller":
			next.size = clampSize(eff.size - s.step);
			break;
		case "stripes":
			next.stripes = !eff.stripes;
			break;
		case "width":
			next.width = eff.width === "full" ? "auto" : "full";
			break;
		case "color":
			next.color = action.color;
			next.stripes = true;
			break;
		case "header":
			next.header = action.header;
			break;
		case "reset":
			return {};
	}
	const defaults = effective({}, s);
	for (const key of Object.keys(next) as (keyof TableStyle)[]) {
		if (next[key] === defaults[key]) delete next[key];
	}
	return next;
}

function tint(color: ColorId, percent: number): string {
	return `color-mix(in srgb, ${COLOR_VARS[color]} ${Math.min(100, percent)}%, transparent)`;
}

/** Aplica o estilo na tabela renderizada (modo leitura ou live preview). */
export function applyStyle(table: HTMLElement, eff: EffectiveStyle, s: TableStylesSettings) {
	table.addClass("ts-table");
	table.toggleClass("ts-striped", eff.stripes);
	table.toggleClass("ts-hover", s.hover);
	table.toggleClass("ts-full", eff.width === "full");
	table.toggleClass("ts-has-header", eff.header !== "none");
	table.setCssProps({
		"--ts-scale": String(eff.size / 100),
		"--ts-stripe": tint(eff.color, s.intensity),
		"--ts-row-hover": tint(eff.color, s.intensity * 2 + 4),
		"--ts-header": eff.header === "none" ? "transparent" : tint(eff.header, s.intensity * 2.5 + 5),
	});
}

/**
 * A linha do marcador da tabela que começa em `tableLine` (contando do 0),
 * ou -1. O marcador fica acima da tabela, com uma linha em branco no meio:
 * sem ela o Obsidian não desenha a tabela no live preview.
 */
export function findMarker(getLine: (n: number) => string, tableLine: number): number {
	let n = tableLine - 1;
	if (n >= 0 && getLine(n).trim() === "") n--;
	return n >= 0 && parseMarker(getLine(n)) ? n : -1;
}

/**
 * O texto que vai acima da tabela: marcador e linha em branco. Sem marcador,
 * só a linha em branco quando há texto logo acima (`above`), para a tabela
 * não grudar nele.
 */
export function markerBlock(style: TableStyle, above: string | undefined): string[] {
	const text = formatMarker(style);
	if (text) return [text, ""];
	return above !== undefined && above.trim() !== "" ? [""] : [];
}

/**
 * Coloca, troca ou remove o marcador acima da linha `tableLine` (a linha do
 * cabeçalho da tabela). Devolve as linhas novas.
 */
export function withMarker(lines: string[], tableLine: number, style: TableStyle): string[] {
	const out = lines.slice();
	const marker = findMarker((n) => out[n], tableLine);
	if (marker < 0 && !formatMarker(style)) return out;
	const from = marker >= 0 ? marker : tableLine;
	out.splice(from, tableLine - from, ...markerBlock(style, out[from - 1]));
	return out;
}

/** Onde ler e gravar o estilo de uma tabela. */
export interface TableRef {
	/** null quando a tabela não foi encontrada na nota. */
	read(): TableStyle | null;
	write(style: TableStyle): Promise<boolean> | boolean;
}
