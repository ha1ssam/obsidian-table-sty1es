import { App, PluginSettingTab, Setting } from "obsidian";
import type TableStylesPlugin from "./main";
import { DEFAULT_COLORS, MAX_SIZE, MIN_SIZE, PRESETS, normalizeHex } from "./table-style";

export class TableStylesSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: TableStylesPlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "These are the defaults for every table. Use the toolbar on a table to change just that one; its choices are saved in a comment right above the table.",
		});

		new Setting(containerEl).setName("Colors").setHeading();

		new Setting(containerEl)
			.setName("Color scheme")
			.setDesc("Color 1 / Color 2 colors rows in turns, with a stronger shade of Color 1 in the header. Default style keeps Obsidian's own look.")
			.addDropdown((d) =>
				d
					.addOption("colors", "Color 1 / Color 2")
					.addOption("none", "Default style (no color)")
					.setValue(s.scheme)
					.onChange(async (v) => {
						await this.save({ scheme: v === "none" ? "none" : "colors" });
						this.display();
					})
			);

		if (s.scheme === "colors") {
			new Setting(containerEl)
				.setName("Color 1")
				.setDesc("Odd rows and the header.")
				.addColorPicker((cp) =>
					cp.setValue(s.color1).onChange((v) => this.save({ color1: normalizeHex(v) ?? s.color1 }))
				);

			new Setting(containerEl)
				.setName("Color 2")
				.setDesc("Even rows.")
				.addColorPicker((cp) =>
					cp.setValue(s.color2).onChange((v) => this.save({ color2: normalizeHex(v) ?? s.color2 }))
				);

			new Setting(containerEl)
				.setName("Presets")
				.setDesc("Pick a ready pair of colors.")
				.addDropdown((d) => {
					d.addOption("", "Choose…");
					for (const p of PRESETS) d.addOption(p.id, p.name);
					d.setValue("").onChange(async (id) => {
						const preset = PRESETS.find((p) => p.id === id);
						if (!preset) return;
						await this.save({ color1: preset.c1, color2: preset.c2 });
						this.display();
					});
				});

			new Setting(containerEl)
				.setName("Reset colors")
				.setDesc("Go back to the pastel palette.")
				.addButton((b) =>
					b.setButtonText("Reset colors").onClick(async () => {
						await this.save({ color1: DEFAULT_COLORS.c1, color2: DEFAULT_COLORS.c2 });
						this.display();
					})
				);

			new Setting(containerEl)
				.setName("Highlight row on hover")
				.addToggle((t) => t.setValue(s.hover).onChange((v) => this.save({ hover: v })));
		}

		new Setting(containerEl).setName("Size").setHeading();

		new Setting(containerEl)
			.setName("Table size")
			.setDesc("Text and cell size, in percent.")
			.addSlider((sl) =>
				sl
					.setLimits(MIN_SIZE, MAX_SIZE, 10)
					.setDynamicTooltip()
					.setValue(s.size)
					.onChange((v) => this.save({ size: v }))
			);

		new Setting(containerEl)
			.setName("Size step")
			.setDesc("How much the bigger and smaller buttons change the size, in percent.")
			.addSlider((sl) =>
				sl
					.setLimits(5, 50, 5)
					.setDynamicTooltip()
					.setValue(s.step)
					.onChange((v) => this.save({ step: v }))
			);

		new Setting(containerEl)
			.setName("Full width")
			.setDesc("Stretch tables across the whole note.")
			.addToggle((t) =>
				t.setValue(s.width === "full").onChange((v) => this.save({ width: v ? "full" : "auto" }))
			);

		new Setting(containerEl).setName("On the table").setHeading();

		new Setting(containerEl)
			.setName("Show toolbar")
			.setDesc("A small bar above each table, shown when you point at or tap the table. The commands work either way.")
			.addToggle((t) => t.setValue(s.toolbar).onChange((v) => this.save({ toolbar: v })));

		new Setting(containerEl)
			.setName("Show resize handles")
			.setDesc("Drag the bottom-right corner, the right or bottom edge, or the border between headers. Double-click a handle for automatic size.")
			.addToggle((t) => t.setValue(s.handles).onChange((v) => this.save({ handles: v })));
	}

	private async save(patch: Partial<TableStylesPlugin["settings"]>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}
}
