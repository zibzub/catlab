# CatLab tester checklist

These checks cover the main Collection and Compose workflows. Report the
browser/device, steps, and whether the issue survives a reload when something
looks wrong.

## Collection

- Search by a rescue ID and by a MoonCat name; clear the search and confirm the
  full result set returns.
- Combine search with trait, hue, genesis, classification, and hue-range
  filters. Remove individual active filters, create zero results, then clear or
  relax filters and confirm recovery in every view.
- Open ColorLab, sample an example image and an uploaded image, replace or
  cancel an upload, clear the color match, and confirm the exact-hue results
  recover.
- Switch between Compact, Details, and List with populated and empty results.
  In List, check touch horizontal scrolling and the sticky identity column.
- Switch Full and Face art in Compact and Details views, including the rings
  setting where it is available.
- Use Select mode to add/remove cats from Palette, open the mobile Palette,
  clear the selection, and use Inspect mode to open and close a cat detail view.
- Reload after changing Collection display preferences and confirm the chosen
  view, compact size, rings, stars, and vignette settings are restored while
  filters and Palette selections are not assumed to persist.

## Compose

- Send selected Palette cats to Compose, add multiple instances, and confirm
  the source tray remains separate from already placed layers.
- Move, resize, rotate, flip, and change opacity for cat, text, and rectangle
  layers. Check layer ordering and selection after several edits.
- Edit a text layer, including longer text and a different font, then leave and
  reselect it.
- Set an editable composition title, save with the default and a custom name,
  and confirm the `.catlab` suffix is applied once. Export PNG with a different
  filename and confirm it does not rename the composition.
- Add, replace, and remove a background image. Confirm `Clear layers` removes
  objects but keeps the background.
- Use the internal stage eyedropper on visible background and object colors;
  cancel it and try it again after changing the selected layer.
- Save a composition with cats, text, rectangles, transforms, and a background;
  reload or start a fresh session, open the `.catlab`, and confirm the scene
  renders and exports without requiring those cats to remain in Palette.
- Open a valid `.catlab` while the current Compose scene has layers or a
  background. Cancel the replacement prompt and confirm nothing changes; then
  repeat and confirm Open replaces the scene only after confirmation.
- Try malformed JSON, an unsupported document version, and a structurally
  invalid `.catlab`. Confirm an error is shown and the current composition is
  not partially replaced.
- Export a normal high-resolution background and confirm the PNG appearance and
  dimensions are unchanged. Also try an unusually large image and confirm the
  export fails with a useful size message instead of freezing the page.

## Mobile and browser coverage

- Repeat the Collection and Compose action-bar flows on a narrow phone-sized
  viewport, including the software keyboard in filename and title fields.
- Check Save, Open confirmation, and Export PNG dialogs on mobile: focus the
  filename field, submit with Enter, cancel with Escape, and reselect the same
  file after canceling Open.
- Repeat the app in a current browser without the native EyeDropper API and
  confirm the internal Compose eyedropper remains available. Quickly replace a
  Compose background with two files and confirm the later choice remains
  current.
