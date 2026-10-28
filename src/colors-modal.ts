import { App, Modal, Setting } from "obsidian";
import { ColorPair, stronger, textOn } from "./table-style";

/** Janela para escolher a Cor 1 e a Cor 2 de uma tabela. */
export class ColorsModal extends Modal {
	private colors: ColorPair;
	private preview: HTMLElement | null = null;

	constructor(
		app: App,
		start: ColorPair,
		private readonly onApply: (colors: ColorPair) => void
	) {
		super(app);
		this.colors = { ...start };
	}

	onOpen() {
		const { contentEl } = this;
		this.titleEl.setText("Table colors");

		new Setting(contentEl)
			.setName("Color 1")
			.setDesc("Odd rows. The header uses a slightly stronger shade.")
			.addColorPicker((cp) =>
				cp.setValue(this.colors.c1).onChange((v) => {
					this.colors.c1 = v;
					this.renderPreview();
				})
			);
		new Setting(contentEl)
			.setName("Color 2")
			.setDesc("Even rows.")
			.addColorPicker((cp) =>
				cp.setValue(this.colors.c2).onChange((v) => {
					this.colors.c2 = v;
					this.renderPreview();
				})
			);

		this.preview = contentEl.createDiv({ cls: "ts-colors-preview" });
		this.renderPreview();

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText("Apply")
					.setCta()
					.onClick(() => {
						this.onApply(this.colors);
						this.close();
					})
			);
	}

	/** Mini tabela com as cores escolhidas, já com o texto legível. */
	private renderPreview() {
		const el = this.preview;
		if (!el) return;
		el.empty();
		const header = stronger(this.colors.c1, 0.08);
		const rows: [string, string][] = [
			[header, "Header"],
			[this.colors.c1, "Color 1"],
			[this.colors.c2, "Color 2"],
		];
		for (const [bg, label] of rows) {
			const row = el.createDiv({ cls: "ts-colors-preview-row", text: label });
			row.setCssProps({ "background-color": bg, color: textOn(bg) });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
