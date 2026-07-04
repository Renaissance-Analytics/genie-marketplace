# Official plugins

The first-party plugins indexed by [`../genie-marketplace.json`](../genie-marketplace.json).
Each lives in its own folder as an **npm-shaped package + `genie-plugin.json`**, installed
individually by Genie. All are published by **Genie Official** (keyId
`ed25519-bHc2Rt62EgjmpE5Fd7-QsJeNi36BsAwckJ4bEyx4BCE`) and are signed by CI on release —
the manifests here are **signing-ready** (no `signature` / `integrity` yet; CI adds both).

| Folder | Plugin | Tool(s) | Editor (declared Fancy mapping) |
| --- | --- | --- | --- |
| [`hello-world/`](hello-world/) | Hello World | `hello.greet` | — |
| [`presentation/`](presentation/) | Presentation | `presentation.createDeck` (`.pptx` via `@particle-academy/dark-slide`) | Slides — `@particle-academy/fancy-slides` `>=0.1.0` → `DeckEditor` (`.pptx`, `.odp`) + Present mode |
| [`spreadsheet/`](spreadsheet/) | Spreadsheet | `spreadsheet.createWorkbook` (`.xlsx`/`.csv` via `@particle-academy/holy-sheet`) | Sheets — `@particle-academy/fancy-sheets` `>=0.1.0` → `SheetWorkbook` (`.xlsx`, `.csv`, `.ods`) |

## Manifest layout

```
plugins/<name>/
  ├── genie-plugin.json    the plugin manifest (id, namespace, mcpTools, editors, capabilities)
  └── tools.cjs            the tools module — runs in the Genie plugin worker
```

Editors are **declared, never shipped**: a plugin names a first-party Fancy
package@version + export, and Genie loads that editor from a vetted,
integrity-pinned Fancy source (design doc §12.2). Plugins never bundle editor UI.

> These three also ship **bundled in the Genie app** (materialised from
> `main/plugins/official.ts`). The copies here are their **installable
> marketplace** form, modeled exactly on those bundled sources.
