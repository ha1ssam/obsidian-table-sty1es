import { App, PluginSettingTab, Setting } from "obsidian";
import type TableStylesPlugin from "./main";
import { COLORS, COLOR_NAMES, MAX_SIZE, MIN_SIZE, isColor } from "./table-style";

export class TableStylesSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: TableStylesPlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();

		const colorOptions = Object.fromEntries(COLORS.map((c) => [c, COLOR_NAMES[c]]));

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "These are the defaults for every table. Use the toolbar on a table to change just that one; its choices are saved in a comment right above the table.",
		});

		new Setting(containerEl).setName("Stripes").setHeading();

		new Setting(containerEl)
			.setName("Zebra stripes")
			.setDesc("Color every other row.")
			.addToggle((t) => t.setValue(s.stripes).onChange((v) => this.save({ stripes: v })));

		new Setting(containerEl)
			.setName("Stripe color")
			.addDropdown((d) =>
				d
					.addOptions(colorOptions)
					.setValue(s.color)
					.onChange((v) => {
						if (isColor(v)) void this.save({ color: v });
					})
			);

		new Setting(containerEl)
			.setName("Color strength")
			.setDesc("How strong the stripe, header and hover colors are.")
			.addSlider((sl) =>
				sl
					.setLimits(3, 40, 1)
					.setDynamicTooltip()
					.setValue(s.intensity)
					.onChange((v) => this.save({ intensity: v }))
			);

		new Setting(containerEl)
			.setName("Header color")
			.addDropdown((d) =>
				d
					.addOption("none", "None")
					.addOptions(colorOptions)
					.setValue(s.header)
					.onChange((v) => {
						if (v === "none" || isColor(v)) void this.save({ header: v });
					})
			);

		new Setting(containerEl)
			.setName("Highlight row on hover")
			.addToggle((t) => t.setValue(s.hover).onChange((v) => this.save({ hover: v })));

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

		new Setting(containerEl).setName("Toolbar").setHeading();

		new Setting(containerEl)
			.setName("Show toolbar on tables")
			.setDesc("A small bar in the corner of each table, shown when you point at or tap the table. The commands work either way.")
			.addToggle((t) => t.setValue(s.toolbar).onChange((v) => this.save({ toolbar: v })));
	}

	private async save(patch: Partial<TableStylesPlugin["settings"]>) {
		Object.assign(this.plugin.settings, patch);
		await this.plugin.saveSettings();
	}
}
