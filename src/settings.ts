import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type TableStylesPlugin from "./main";
import {
	DEFAULT_COLORS,
	MAX_SIZE,
	MIN_SIZE,
	PRESETS,
	TableStylesSettings,
	normalizeHex,
} from "./table-style";

const TEXT = {
	intro: "These are the defaults for every table. Use the toolbar on a table to change just that one; its choices are saved in a comment right above the table.",
	scheme: {
		name: "Color scheme",
		desc: "Color 1 / Color 2 colors rows in turns, with a stronger shade of Color 1 in the header. Default style keeps Obsidian's own look.",
		options: { colors: "Color 1 / Color 2", none: "Default style (no color)" },
	},
	color1: { name: "Color 1", desc: "Odd rows and the header." },
	color2: { name: "Color 2", desc: "Even rows." },
	preset: { name: "Presets", desc: "Pick a ready pair of colors." },
	reset: { name: "Reset colors", desc: "Go back to the pastel palette." },
	hover: { name: "Highlight row on hover", desc: "" },
	size: { name: "Table size", desc: "Text and cell size, in percent." },
	step: { name: "Size step", desc: "How much the bigger and smaller buttons change the size, in percent." },
	width: { name: "Full width", desc: "Stretch tables across the whole note." },
	toolbar: {
		name: "Show toolbar",
		desc: "A small bar above each table, shown when you point at or tap the table. The commands work either way.",
	},
	handles: {
		name: "Show resize handles",
		desc: "Drag the bottom-right corner, the right or bottom edge, or the border between headers. Double-click a handle for automatic size.",
	},
};

const CUSTOM_PRESET = "custom";

export class TableStylesSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: TableStylesPlugin) {
		super(app, plugin);
	}

	private get s(): TableStylesSettings {
		return this.plugin.settings;
	}

	private colorsOn = () => this.s.scheme === "colors";

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: "About", desc: TEXT.intro, searchable: false },
			{
				type: "group",
				heading: "Colors",
				items: [
					{ ...TEXT.scheme, control: { type: "dropdown", key: "scheme", options: TEXT.scheme.options } },
					{ ...TEXT.color1, visible: this.colorsOn, control: { type: "color", key: "color1" } },
					{ ...TEXT.color2, visible: this.colorsOn, control: { type: "color", key: "color2" } },
					{
						...TEXT.preset,
						aliases: PRESETS.map((p) => p.name),
						visible: this.colorsOn,
						control: { type: "dropdown", key: "preset", options: this.presetOptions() },
					},
					{ ...TEXT.reset, visible: this.colorsOn, action: () => void this.resetColors() },
					{ name: TEXT.hover.name, visible: this.colorsOn, control: { type: "toggle", key: "hover" } },
				],
			},
			{
				type: "group",
				heading: "Size",
				items: [
					{ ...TEXT.size, control: { type: "slider", key: "size", min: MIN_SIZE, max: MAX_SIZE, step: 10 } },
					{ ...TEXT.step, control: { type: "slider", key: "step", min: 5, max: 50, step: 5 } },
					{ ...TEXT.width, control: { type: "toggle", key: "fullWidth" } },
				],
			},
			{
				type: "group",
				heading: "On the table",
				items: [
					{ ...TEXT.toolbar, control: { type: "toggle", key: "toolbar" } },
					{ ...TEXT.handles, control: { type: "toggle", key: "handles" } },
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const s = this.s;
		switch (key) {
			case "scheme":
				return s.scheme;
			case "color1":
				return s.color1;
			case "color2":
				return s.color2;
			case "preset":
				return PRESETS.find((p) => p.c1 === s.color1 && p.c2 === s.color2)?.id ?? CUSTOM_PRESET;
			case "hover":
				return s.hover;
			case "size":
				return s.size;
			case "step":
				return s.step;
			case "fullWidth":
				return s.width === "full";
			case "toolbar":
				return s.toolbar;
			case "handles":
				return s.handles;
		}
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.s;
		switch (key) {
			case "scheme":
				await this.save({ scheme: value === "none" ? "none" : "colors" });
				// As opções de cor aparecem ou somem.
				this.refresh();
				return;
			case "color1":
				// Sem redesenhar: o seletor de cor ainda pode estar aberto.
				return this.save({ color1: normalizeHex(value as string) ?? s.color1 });
			case "color2":
				return this.save({ color2: normalizeHex(value as string) ?? s.color2 });
			case "preset": {
				const preset = PRESETS.find((p) => p.id === value);
				if (!preset) return;
				await this.save({ color1: preset.c1, color2: preset.c2 });
				this.refresh();
				return;
			}
			case "hover":
				return this.save({ hover: value === true });
			case "size":
				return this.save({ size: Number(value) || s.size });
			case "step":
				return this.save({ step: Number(value) || s.step });
			case "fullWidth":
				return this.save({ width: value === true ? "full" : "auto" });
			case "toolbar":
				return this.save({ toolbar: value === true });
			case "handles":
				return this.save({ handles: value === true });
		}
	}

	private presetOptions(): Record<string, string> {
		const options: Record<string, string> = { [CUSTOM_PRESET]: "Custom" };
		for (const p of PRESETS) options[p.id] = p.name;
		return options;
	}

	private async resetColors() {
		await this.save({ color1: DEFAULT_COLORS.c1, color2: DEFAULT_COLORS.c2 });
		this.refresh();
	}

	private async save(patch: Partial<TableStylesSettings>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}

	/** Redesenha a tela. update() existe a partir do 1.13; antes, display(). */
	private refresh() {
		const tab = this as unknown as { update?: () => void; display: () => void };
		if (typeof tab.update === "function") tab.update();
		else if (this.containerEl.isShown()) tab.display();
	}

	/** Para versões do Obsidian anteriores à 1.13.0. */
	display(): void {
		const { containerEl } = this;
		const s = this.s;
		containerEl.empty();
		const set = (key: string) => (value: unknown) => void this.setControlValue(key, value);

		containerEl.createEl("p", { cls: "setting-item-description", text: TEXT.intro });

		new Setting(containerEl).setName("Colors").setHeading();
		new Setting(containerEl)
			.setName(TEXT.scheme.name)
			.setDesc(TEXT.scheme.desc)
			.addDropdown((d) => d.addOptions(TEXT.scheme.options).setValue(s.scheme).onChange(set("scheme")));

		if (this.colorsOn()) {
			new Setting(containerEl)
				.setName(TEXT.color1.name)
				.setDesc(TEXT.color1.desc)
				.addColorPicker((cp) => cp.setValue(s.color1).onChange(set("color1")));
			new Setting(containerEl)
				.setName(TEXT.color2.name)
				.setDesc(TEXT.color2.desc)
				.addColorPicker((cp) => cp.setValue(s.color2).onChange(set("color2")));
			new Setting(containerEl)
				.setName(TEXT.preset.name)
				.setDesc(TEXT.preset.desc)
				.addDropdown((d) =>
					d
						.addOptions(this.presetOptions())
						.setValue(this.getControlValue("preset") as string)
						.onChange(set("preset"))
				);
			new Setting(containerEl)
				.setName(TEXT.reset.name)
				.setDesc(TEXT.reset.desc)
				.addButton((b) => b.setButtonText(TEXT.reset.name).onClick(() => void this.resetColors()));
			new Setting(containerEl)
				.setName(TEXT.hover.name)
				.addToggle((t) => t.setValue(s.hover).onChange(set("hover")));
		}

		new Setting(containerEl).setName("Size").setHeading();
		new Setting(containerEl)
			.setName(TEXT.size.name)
			.setDesc(TEXT.size.desc)
			.addSlider((sl) => sl.setLimits(MIN_SIZE, MAX_SIZE, 10).setValue(s.size).onChange(set("size")));
		new Setting(containerEl)
			.setName(TEXT.step.name)
			.setDesc(TEXT.step.desc)
			.addSlider((sl) => sl.setLimits(5, 50, 5).setValue(s.step).onChange(set("step")));
		new Setting(containerEl)
			.setName(TEXT.width.name)
			.setDesc(TEXT.width.desc)
			.addToggle((t) => t.setValue(s.width === "full").onChange(set("fullWidth")));

		new Setting(containerEl).setName("On the table").setHeading();
		new Setting(containerEl)
			.setName(TEXT.toolbar.name)
			.setDesc(TEXT.toolbar.desc)
			.addToggle((t) => t.setValue(s.toolbar).onChange(set("toolbar")));
		new Setting(containerEl)
			.setName(TEXT.handles.name)
			.setDesc(TEXT.handles.desc)
			.addToggle((t) => t.setValue(s.handles).onChange(set("handles")));
	}
}
