# Table Sty1es

Style each table in Obsidian on its own: two-color rows with a matching header, drag the corners to resize, align each column, and make the text bigger or smaller.

Works in reading view and live preview, on desktop and mobile.

## Colors: Color 1 / Color 2

New tables get alternating rows in Color 1 and Color 2, with a slightly stronger shade of Color 1 in the header. Colors are solid, and the text switches between dark and light to stay readable in light and dark themes.

The default palette is pastel blue (`#DCEBFA`) and pastel lilac (`#F5F0FA`). Presets: blue, green, pink, yellow, lilac and peach.

- **Settings:** pick Color 1 and Color 2 for every new table, choose a preset, or press **Reset colors** to go back to the pastel palette. **Default style (no color)** keeps Obsidian's own look.
- **One table:** the palette button on the toolbar changes only that table: a preset, **Custom colors…**, **Reset colors** (back to your defaults) or **Default style (no color)**.

Themes can use the CSS variables `--tbl-color-1`, `--tbl-color-2`, `--tbl-header` and `--tbl-hover`.

## Resize by dragging

Point at a table (or tap it on mobile) to show the handles:

| Handle | What it does |
|---|---|
| Bottom-right corner | Width and height; the width is shared among the columns in proportion |
| Right edge | Width |
| Bottom edge | Height |
| Border between headers | Width of one column |

Columns can't get narrower than a short word, and the table can't get wider than the note. **Double-click** any handle to go back to automatic size.

## Align columns

Point at a cell of the column, then use the **left / center / right** buttons on the toolbar. You can also right-click a header in reading view, or right-click a cell in the editor. Alignment is written the standard Markdown way in the separator row (`:---`, `:---:`, `---:`), so other apps show it too.

## Toolbar

| Button | What it does |
|---|---|
| − / + | Make the text smaller or bigger (the current size shows between them) |
| Palette | Colors for this table |
| Align left / center / right | Align the column you last pointed at |
| Width | Stretch the table across the whole note |
| Reset | Go back to your default style (alignment stays) |

## Where the style is saved

Each table's choices are written in a comment above it, followed by a blank line, so they travel with the note. Live preview hides the comment:

```md
<!-- table-style: size=120 c1=#dff2e1 c2=#f2faf3 cols=120,200,80 h=240 -->

| Name | Score |
|:-----|:-----:|
| Ana  | 10    |
```

Only the options that differ from your defaults are written. Tables without a comment use your defaults, and comments from older versions keep working.

## Commands

With the cursor in a table: **Make table bigger / smaller**, **Toggle table colors**, **Reset table colors**, **Toggle table full width**, **Reset table size to automatic**, **Reset table style**, and **Align table column: left / center / right** (the column at the cursor). Give them hotkeys in Settings → Hotkeys, for example one to center a column.

## Install manually

Copy `main.js`, `manifest.json` and `styles.css` from the latest release into `<vault>/.obsidian/plugins/table-styles/`, then turn the plugin on in Settings → Community plugins.
