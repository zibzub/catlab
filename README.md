# CatLab

CatLab is a local-first MoonCat index and palette workspace. It loads one
generated metadata index and local bare/native atlas sheets, filters them in the
browser, virtualizes the collection rows, and lets Collection clicks either add
or remove cats from an app-level Palette or open a local Template Frame detail
card in Inspect mode.

## Setup

```sh
npm install
npm run generate -- --traits ../mckb/references/upstream/mooncatrescue/mooncat_traits.json
npm run generate:classifications
npm run validate:generated
npm run dev
```

The generator defaults to
`../mckb/references/upstream/mooncatrescue/mooncat_traits.json` when that sibling
file exists. Override it with the explicit `--traits <path>` option or the
`CATLAB_TRAITS` environment variable. The input is read-only; the generator
never edits sibling repositories and never calls a MoonCat data or image API.

## Generated data

`npm run generate` writes `public/data/`:

- `mooncats.json` is the compact all-cat index. `cats[n]` is rescue order `n`;
  each row follows `fields`. Repeated string traits are integer indexes into
  `dictionaries`, while `catId`, year, and hue integer remain direct values.
  `pale` and `genesis` are encoded as `0`/`1` flags. Accessories and names are
  intentionally not part of this milestone's runtime schema.
- `atlas-manifest.json` records the schema, parser/source hashes, cell and
  sheet dimensions, and deterministic rescue-order-to-cell mapping.
- `mooncat-names.json` is the copied static CatMoon name map used by Inspect
  mode. A missing or invalid names file falls back to an unnamed title.
- `mooncat-classifications.json` is a compact artifact containing the relevant
  early/community category sets. Regenerate it from the sibling CatMoon filter
  source with `npm run generate:classifications -- --source <path>`.
- `atlases/atlas-000.webp` through the final sheet contain 256 fixed 21×22
  transparent native-resolution cells (the final sheet is partially filled).
  Native cat matrices are horizontally centered and bottom-aligned to a
  shared platform baseline.
  Sheets use lossless WebP so the site has about 100 image files instead of
  25,440 individual thumbnails, staying well below static-host file limits.

The build and normal runtime only consume generated files already in CatLab.
They do not regenerate from the sibling input, fetch remote images, or require
the sibling repository after generation.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run generate -- --traits <path>` | Validate traits and generate the local index/atlases. |
| `npm run generate:classifications -- --source <path>` | Generate the compact Inspect-mode classification artifact from CatMoon filter data. |
| `npm run validate:classifications` | Validate the compact classification artifact. |
| `npm run validate:generated` | Validate the generated schema, atlas sheets, WebP dimensions, and classification artifact. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run build` | Build the static app from local source and generated assets. |

The parser is the official `mooncatparser` 1.0.0 package. Its required notice
is preserved in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The Inspect-mode Template Frame, `template_full.png`, Pixel Operator fonts, and
action icons are adapted from the current local CatMoon public assets. They are
kept in CatLab as local runtime assets; the sibling CatMoon checkout is not
needed at runtime.

## Intentional boundaries

This milestone does not include glow rendering, accessories, drag-and-drop,
wallet/web3 data, ownership/listings, future classification filter controls, or
a meme compositor. Those can be layered after the Index → Palette foundation
without moving selection state into the grid.
