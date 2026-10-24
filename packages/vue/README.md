# @mapette/vue

Vue 3 components for [`@mapette/core`](https://www.npmjs.com/package/@mapette/core).

```bash
npm i @mapette/vue @mapette/core maplibre-gl
```

The package ships its `.vue` sources so that your bundler compiles them for both server and client; with Vite this works out of the box. Server rendering is supported: the map itself mounts on the client.

## Components

- **`MapView`** – the map. Props mirror `createMap` (`preset`, `mapStyle`, `locale`, `center`, `zoom`, `interactive`, `dark`, `theme`, `padding`, `keepSources`, `popovers`, `scale`). Children get the controller through `useMap()`.
- **`MapExplorer`** – the full-screen layout used by both sites: `MapView` (explore preset), scale bar, compass / locate / zoom buttons, `MapSheet`, padding wiring (dragging the map lowers the sheet on phones), and keyboard shortcuts (`+ −` zoom, `L` locate, `N` north, `Esc` back; add your own with `shortcuts`). Slots: `#map`, `#header`, default, `#footer`.
- **`MapSheet`** – side panel / bottom sheet on its own (`v-model:snap`, `@update:padding`).
- **`MapFooter`** – attribution, data sources, shortcuts help, theme toggle and language select, with built-in texts in four languages.
- **`UpdateToast`** – registers the service worker and shows a "new version available · reload" pill at the top when one is waiting, in four languages. Pass `:register="import.meta.env.PROD"` so the dev server is never cached.
- **`MapControls`, `ScaleBar`, `LocationMarker`, `PhotoPins`, `ClusterExpand`, `ClusterPopover`, `MapPopover`** – thin wrappers over the core objects.

## Composables

`useMap`, `useMapObject`, `useViewportFeatures`, `useDarkMode`, `useThemePref`.

## License

MIT
