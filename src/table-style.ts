// Modelo do estilo de cada tabela e o marcador que o guarda na nota.
// O marcador é um comentário HTML acima da tabela, com uma linha em branco
// no meio, por exemplo:
//   <!-- table-style: size=120 c1=#dfecfa c2=#f5f0fa cols=120,200 h=240 -->
// Só aparecem as opções que diferem do padrão das configurações.
// O alinhamento das colunas não fica aqui: vai na linha separadora da
// tabela (:---, :---:, ---:), que é o padrão do Markdown.

// ---------- Cores ----------

export interface ColorPair {
	c1: string;
	c2: string;
}

export interface Preset extends ColorPair {
	id: string;
	name: string;
}

/** Paleta padrão: azul pastel e lilás pastel. */
export const DEFAULT_COLORS: ColorPair = { c1: "#dcebfa", c2: "#f5f0fa" };

export const PRESETS: Preset[] = [
	{ id: "pastel", name: "Pastel (default)", ...DEFAULT_COLORS },
	{ id: "blue", name: "Blue", c1: "#dcebfa", c2: "#f0f6fd" },
	{ id: "green", name: "Green", c1: "#dff2e1", c2: "#f2faf3" },
	{ id: "pink", name: "Pink", c1: "#fadde6", c2: "#fdf2f5" },
	{ id: "yellow", name: "Yellow", c1: "#fff4cc", c2: "#fffbea" },
	{ id: "lilac", name: "Lilac", c1: "#ebe3f7", c2: "#f5f0fa" },
	{ id: "peach", name: "Peach", c1: "#ffe3d3", c2: "#fff4ed" },
];

/** Cores das versões antigas do marcador (`color=blue`) e o preset que as substitui. */
const LEGACY_COLORS: Record<string, string> = {
	blue: "blue",
	cyan: "blue",
	accent: "lilac",
	purple: "lilac",
	green: "green",
	pink: "pink",
	red: "pink",
	yellow: "yellow",
	orange: "peach",
};

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** Normaliza uma cor para `#rrggbb`. Devolve null se não for uma cor. */
export function normalizeHex(value: string | undefined): string | null {
	const match = HEX.exec((value ?? "").trim());
	if (!match) return null;
	let hex = match[1].toLowerCase();
	if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
	return `#${hex}`;
}

function toRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]): string {
	return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function toHsl([r, g, b]: number[]): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [h / 6, s, l];
}

function fromHsl([h, s, l]: number[]): number[] {
	if (s === 0) return [l * 255, l * 255, l * 255];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/** A mesma cor, mais forte: um pouco mais escura e saturada. Sempre sólida. */
export function stronger(hex: string, amount: number): string {
	const [h, s, l] = toHsl(toRgb(hex));
	return toHex(fromHsl([h, Math.min(1, s + amount), Math.max(0, l - amount)]));
}

/** Luminância relativa (WCAG), de 0 (preto) a 1 (branco). */
function luminance(hex: string): number {
	const [r, g, b] = toRgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_TEXT = "#1f2328";
const LIGHT_TEXT = "#f5f6f7";

/** Texto legível sobre o fundo: escuro em cores claras, claro em cores escuras. */
export function textOn(hex: string): string {
	const l = luminance(hex);
	const darkText = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
	const lightText = (luminance(LIGHT_TEXT) + 0.05) / (l + 0.05);
	return darkText >= lightText ? DARK_TEXT : LIGHT_TEXT;
}

/** Cor de link legível sobre o fundo. */
function linkOn(hex: string): string {
	return textOn(hex) === DARK_TEXT ? "#1f5fbf" : "#9cc3ff";
}

// ---------- Tamanho e alinhamento ----------

export const MIN_SIZE = 50;
export const MAX_SIZE = 250;
/** Menor largura de coluna, em "em": cabe uma palavra curta. */
export const MIN_COL_EM = 3;

export type Width = "auto" | "full";
export type Align = "left" | "center" | "right";
export const ALIGN_NAMES: Record<Align, string> = { left: "Left", center: "Center", right: "Right" };

// ---------- Estilo da tabela ----------

/** Opções guardadas no marcador. O que falta vem das configurações. */
export interface TableStyle {
	size?: number;
	/** false = estilo nativo do Obsidian (sem cor); true = Cor 1 / Cor 2. */
	colors?: boolean;
	c1?: string;
	c2?: string;
	width?: Width;
	/** Largura de cada coluna, em px. */
	cols?: number[];
	/** Altura da tabela, em px. */
	h?: number;
}

export interface EffectiveStyle {
	size: number;
	colors: boolean;
	c1: string;
	c2: string;
	width: Width;
	cols: number[] | null;
	h: number | null;
}

export type ColorScheme = "colors" | "none";

export interface TableStylesSettings {
	size: number;
	scheme: ColorScheme;
	color1: string;
	color2: string;
	width: Width;
	hover: boolean;
	/** Quanto o tamanho muda a cada clique, em pontos percentuais. */
	step: number;
	toolbar: boolean;
	handles: boolean;
}

export const DEFAULT_SETTINGS: TableStylesSettings = {
	size: 100,
	scheme: "colors",
	color1: DEFAULT_COLORS.c1,
	color2: DEFAULT_COLORS.c2,
	width: "auto",
	hover: true,
	step: 10,
	toolbar: true,
	handles: true,
};

/** Lê as configurações salvas, inclusive as da versão anterior. */
export function loadSettings(data: unknown): TableStylesSettings {
	const raw = (data ?? {}) as Record<string, unknown>;
	const s: TableStylesSettings = { ...DEFAULT_SETTINGS };
	if (typeof raw.size === "number") s.size = clampSize(raw.size);
	if (raw.scheme === "colors" || raw.scheme === "none") s.scheme = raw.scheme;
	// Versão anterior: listras desligadas viram "sem cor".
	else if (raw.stripes === false) s.scheme = "none";
	s.color1 = normalizeHex(raw.color1 as string) ?? s.color1;
	s.color2 = normalizeHex(raw.color2 as string) ?? s.color2;
	if (raw.width === "auto" || raw.width === "full") s.width = raw.width;
	if (typeof raw.hover === "boolean") s.hover = raw.hover;
	if (typeof raw.step === "number") s.step = raw.step;
	if (typeof raw.toolbar === "boolean") s.toolbar = raw.toolbar;
	if (typeof raw.handles === "boolean") s.handles = raw.handles;
	return s;
}

export type TableAction =
	| { type: "bigger" }
	| { type: "smaller" }
	| { type: "colors"; c1: string; c2: string }
	| { type: "no-colors" }
	| { type: "toggle-colors" }
	| { type: "reset-colors" }
	| { type: "width" }
	| { type: "resize"; cols: number[] | null; h: number | null }
	| { type: "reset" };

const MARKER = /^\s*<!--\s*table-style:?(.*?)-->\s*$/;

const clampSize = (n: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));

/** Lê um marcador. Devolve null se a linha não for um marcador. */
export function parseMarker(line: string | undefined): TableStyle | null {
	const match = MARKER.exec(line ?? "");
	if (!match) return null;
	const style: TableStyle = {};
	for (const token of match[1].trim().split(/\s+/)) {
		const [key, value = ""] = token.split("=");
		switch (key) {
			case "size": {
				const n = parseInt(value, 10);
				if (!isNaN(n)) style.size = clampSize(n);
				break;
			}
			case "colors":
				if (value === "on" || value === "none") style.colors = value === "on";
				break;
			case "c1":
			case "c2": {
				const hex = normalizeHex(value);
				if (hex) style[key] = hex;
				break;
			}
			case "width":
				if (value === "auto" || value === "full") style.width = value;
				break;
			case "cols": {
				const cols = value.split(",").map((v) => parseInt(v, 10));
				if (cols.length && cols.every((n) => n > 0)) style.cols = cols;
				break;
			}
			case "h": {
				const n = parseInt(value, 10);
				if (n > 0) style.h = n;
				break;
			}
			// Versão anterior do marcador.
			case "stripes":
				if (value === "off") style.colors = false;
				break;
			case "color": {
				const preset = PRESETS.find((p) => p.id === LEGACY_COLORS[value]);
				if (preset && style.c1 === undefined) {
					style.c1 = preset.c1;
					style.c2 = preset.c2;
				}
				break;
			}
		}
	}
	return style;
}

/** Monta o marcador. Devolve null quando não há nada a guardar. */
export function formatMarker(style: TableStyle): string | null {
	const parts: string[] = [];
	if (style.size !== undefined) parts.push(`size=${style.size}`);
	if (style.colors !== undefined) parts.push(`colors=${style.colors ? "on" : "none"}`);
	if (style.c1 !== undefined) parts.push(`c1=${style.c1}`);
	if (style.c2 !== undefined) parts.push(`c2=${style.c2}`);
	if (style.width !== undefined) parts.push(`width=${style.width}`);
	if (style.cols !== undefined) parts.push(`cols=${style.cols.join(",")}`);
	if (style.h !== undefined) parts.push(`h=${style.h}`);
	return parts.length ? `<!-- table-style: ${parts.join(" ")} -->` : null;
}

export function effective(style: TableStyle, s: TableStylesSettings): EffectiveStyle {
	return {
		size: style.size ?? s.size,
		colors: style.colors ?? s.scheme === "colors",
		c1: style.c1 ?? s.color1,
		c2: style.c2 ?? s.color2,
		width: style.width ?? s.width,
		cols: style.cols ?? null,
		h: style.h ?? null,
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
		case "colors":
			next.colors = true;
			next.c1 = normalizeHex(action.c1) ?? eff.c1;
			next.c2 = normalizeHex(action.c2) ?? eff.c2;
			break;
		case "no-colors":
			next.colors = false;
			break;
		case "toggle-colors":
			next.colors = !eff.colors;
			break;
		case "reset-colors":
			delete next.c1;
			delete next.c2;
			next.colors = true;
			break;
		case "width":
			next.width = eff.width === "full" ? "auto" : "full";
			// Largura total e colunas com tamanho fixo não combinam.
			if (next.width === "full") delete next.cols;
			break;
		case "resize":
			if (action.cols) {
				next.cols = action.cols.map((n) => Math.round(n));
				next.width = "auto";
			} else {
				delete next.cols;
			}
			if (action.h) next.h = Math.round(action.h);
			else delete next.h;
			break;
		case "reset":
			return {};
	}
	const defaults = effective({}, s);
	if (next.size === defaults.size) delete next.size;
	if (next.colors === defaults.colors) delete next.colors;
	if (next.c1 === defaults.c1) delete next.c1;
	if (next.c2 === defaults.c2) delete next.c2;
	if (next.width === defaults.width) delete next.width;
	return next;
}

/** Quantas variáveis de largura de coluna a tabela usa agora. */
const COL_COUNT = "tsCols";

/**
 * Aplica só o tamanho (colunas e altura). Também usado durante o arraste,
 * antes de gravar na nota.
 */
export function applySize(table: HTMLElement, cols: number[] | null, h: number | null) {
	const el = table as HTMLTableElement;
	const columns = el.rows?.[0]?.cells.length ?? 0;
	const props: Record<string, string> = {};
	const useCols = !!cols && cols.length === columns;
	const before = parseInt(table.dataset[COL_COUNT] ?? "0", 10);
	for (let i = 0; i < Math.max(before, columns); i++) {
		props[`--ts-col-${i + 1}`] = useCols && cols ? `${cols[i]}px` : "";
	}
	table.dataset[COL_COUNT] = String(useCols ? columns : 0);
	props["--ts-width"] = useCols && cols ? `${cols.reduce((a, b) => a + b, 0)}px` : "";
	const rows = el.rows?.length ?? 0;
	props["--ts-row-h"] = h && rows ? `${h / rows}px` : "";
	table.toggleClass("ts-cols", useCols);
	table.toggleClass("ts-rows", !!h && rows > 0);
	table.setCssProps(props);
}

/** Aplica o estilo na tabela renderizada (modo leitura ou live preview). */
export function applyStyle(table: HTMLElement, eff: EffectiveStyle, s: TableStylesSettings) {
	table.addClass("ts-table");
	table.toggleClass("ts-colored", eff.colors);
	table.toggleClass("ts-hover", eff.colors && s.hover);
	table.toggleClass("ts-full", eff.width === "full");
	const header = stronger(eff.c1, 0.08);
	const hover = stronger(eff.c2, 0.06);
	table.setCssProps({
		"--ts-scale": String(eff.size / 100),
		"--tbl-color-1": eff.c1,
		"--tbl-color-2": eff.c2,
		"--tbl-header": header,
		"--tbl-hover": hover,
		"--tbl-text-1": textOn(eff.c1),
		"--tbl-text-2": textOn(eff.c2),
		"--tbl-header-text": textOn(header),
		"--tbl-hover-text": textOn(hover),
		"--tbl-link-1": linkOn(eff.c1),
		"--tbl-link-2": linkOn(eff.c2),
		"--tbl-header-link": linkOn(header),
	});
	applySize(table, eff.width === "full" ? null : eff.cols, eff.h);
}

// ---------- Marcador na nota ----------

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

// ---------- Alinhamento na linha separadora ----------

export const DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Separa as partes de uma linha de tabela, guardando as bordas `|`. */
function splitRow(line: string): { lead: string; cells: string[]; trail: string } {
	const m = /^(\s*\|?)(.*?)(\|?\s*)$/.exec(line) ?? ["", "", line, ""];
	return { lead: m[1], cells: m[2].split("|"), trail: m[3] };
}

/** Troca o alinhamento da coluna `col` (do 0) na linha separadora. */
export function setAlignment(delimiter: string, col: number, align: Align): string | null {
	if (!DELIMITER_ROW.test(delimiter)) return null;
	const { lead, cells, trail } = splitRow(delimiter);
	if (col < 0 || col >= cells.length) return null;
	const cell = cells[col];
	// Mantém a largura da célula, para a tabela continuar alinhada no texto.
	const width = Math.max(3, cell.trim().length);
	const pad = (text: string) => (cell.startsWith(" ") ? " " : "") + text + (cell.endsWith(" ") ? " " : "");
	const body =
		align === "center"
			? `:${"-".repeat(width - 2)}:`
			: align === "right"
				? `${"-".repeat(width - 1)}:`
				: `:${"-".repeat(width - 1)}`;
	cells[col] = pad(body);
	return lead + cells.join("|") + trail;
}

/** O alinhamento atual da coluna `col` na linha separadora. */
export function getAlignment(delimiter: string, col: number): Align | null {
	if (!DELIMITER_ROW.test(delimiter)) return null;
	const cell = splitRow(delimiter).cells[col]?.trim();
	if (!cell) return null;
	if (cell.startsWith(":") && cell.endsWith(":")) return "center";
	if (cell.endsWith(":")) return "right";
	if (cell.startsWith(":")) return "left";
	return null;
}

/** A coluna (do 0) em que está a posição `ch` de uma linha da tabela. */
export function columnAt(line: string, ch: number): number {
	const before = line.slice(0, ch).replace(/\\\|/g, "");
	const pipes = (before.match(/\|/g) ?? []).length;
	return Math.max(0, line.trimStart().startsWith("|") ? pipes - 1 : pipes);
}

// ---------- Onde a tabela está ----------

/** Onde ler e gravar o estilo e o alinhamento de uma tabela. */
export interface TableRef {
	/** null quando a tabela não foi encontrada na nota. */
	read(): TableStyle | null;
	write(style: TableStyle): Promise<boolean> | boolean;
	/** A linha separadora da tabela (a de `---`), ou null. */
	readDelimiter(): string | null;
	writeDelimiter(text: string): Promise<boolean> | boolean;
}
