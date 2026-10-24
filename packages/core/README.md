# @mapette/core

Framework-agnostic map UI on [MapLibre GL](https://maplibre.org/) for sites built around places and photos. Everything that touches the DOM or MapLibre lives here; [`@mapette/vue`](https://www.npmjs.com/package/@mapette/vue) is a thin binding.

```bash
npm i @mapette/core maplibre-gl
```

```ts
import { createMap } from "@mapette/core";
import "@mapette/core/mapette.css";

const ctrl = await createMap({ container: el, preset: "compact", center: [135.77, 34.97], zoom: 13 });
```

## What's inside

- **`createMap(options)`** – creates the map and returns a controller. MapLibre is loaded lazily, so this is safe in server-rendered apps.
  - `preset`: `static` (display only), `compact` (pan and zoom, no rotation; for cards), `explore` (full screen, globe, view in the URL hash).
  - `interactive` overrides the preset per feature, e.g. `{ pan: false }`.
  - `style`: a style URL, a style object, or a function of `{ palette, dark, locale }`. Defaults to the mapette basemap.
  - Follows the page's color scheme (`data-theme`, `.dark`, or the system), keeps given `keepSources` across restyles, and avoids panels via `padding`.
  - `controller.reveal(lngLat)` pans a location into view without changing the zoom.
- **Basemap and overlays** – `createBasemap`, `clusterSource` / `clusterLayers`, `pointLayer`, `focusPointLayer`, `heatmapLayer`, `coneLayers` with `viewCone` / `fieldOfView` for camera directions.
- **Controls** – `ScaleBar`, `MapButtons` (compass, locate, zoom), `ClusterExpander`.
- **Markers and popovers** – `LocationMarker`, `PhotoPins` (photos on the map at street zoom), `MapPopover` (positioned with Floating UI inside the visible map; card or menu style; card style is off unless `popovers: true`).
- **Layout** – `Sheet`: side panel on desktop, bottom sheet on phones that moves as one piece: below full height any vertical drag moves the whole sheet, at full height the content scrolls and pulling down from the top lowers the sheet. It reports the area it covers, and the map keeps its view still when that area changes.
- **Theme** – CSS variables (`--mapette-*`, each split into `-light` / `-dark` halves), `applyTheme(el, theme)`, built-in `themes` (`neutral`, the default, and `cool`, with bluer land, buildings and roads), theme preference helpers and `themeInitScript` for a flash-free first paint.
- **Locale and SEO** – path-prefix locales (`/`, `/zh-hant`, `/ja`, `/en`), built-in UI texts in four languages (`kitText`), `seoHead` for localized `<head>` data.
- **Keyboard** – `onShortcuts` that ignores typing in inputs and IME composition.

## License

MIT. The default basemap uses [OpenFreeMap](https://openfreemap.org/) tiles (© OpenStreetMap contributors) and AWS Terrain Tiles; keep the attribution visible.
