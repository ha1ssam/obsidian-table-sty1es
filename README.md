# Table Sty1es

Style each table in Obsidian on its own: make it bigger or smaller, add zebra stripes (every other row colored), and pick stripe and header colors.

## Toolbar

Point at a table (or tap it on mobile) and a small toolbar shows up in its corner:

| Button | What it does |
|---|---|
| − / + | Make the table smaller or bigger |
| Stripes | Turn zebra stripes on or off |
| Palette | Pick the stripe color and the header color |
| Width | Stretch the table across the whole note |
| Reset | Go back to your default style |

It works in reading view and in live preview.

## Where the style is saved

Each table's choices are written in a comment right above it, so they travel with the note:

```md
<!-- table-style: size=120 stripes=on color=blue header=blue width=full -->
| Name | Score |
|------|-------|
| Ana  | 10    |
```

Only the options that differ from your defaults are written. Reset removes the comment.

## Commands

With the cursor in a table: **Make table bigger**, **Make table smaller**, **Toggle table stripes**, **Toggle table full width**, **Reset table style**. Give them hotkeys in Settings → Hotkeys.

## Settings

Defaults for every table: stripes on or off, stripe color, header color, color strength, row highlight on hover, table size, size step, full width, and whether to show the toolbar.

## Install manually

Copy `main.js`, `manifest.json` and `styles.css` from the latest release into `<vault>/.obsidian/plugins/table-sty1es/`, then turn the plugin on in Settings → Community plugins.
