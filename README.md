# mapette

Map UI for place-and-photo sites, built on [MapLibre](https://maplibre.org/): an Apple Maps–like basemap, cluster bubbles, photo pins, popovers, and a full-screen layout with a side panel on desktop and a draggable bottom sheet on phones.

It powers [junrei.jannchie.com](https://junrei.jannchie.com) (anime pilgrimage spots) and a photo spot map, and is meant to fit small embedded maps just as well.

| Package | |
|---|---|
| [`@mapette/core`](packages/core) | Framework-agnostic: basemap style, overlays, map controller, controls, markers, popovers, bottom sheet, theme and locale helpers |
| [`@mapette/vue`](packages/vue) | Vue 3 components: `MapView`, `MapExplorer`, `MapSheet`, `MapFooter`, `PhotoPins`, `ClusterPopover`, … |

## A small map

```vue
<script setup lang="ts">
import { LocationMarker, MapView } from "@mapette/vue";
</script>

<template>
  <div style="height: 200px">
    <MapView preset="compact" :center="[135.77, 34.97]" :zoom="14">
      <LocationMarker :lng-lat="[135.77, 34.97]" pulse />
    </MapView>
  </div>
</template>
```

## A full-screen map with a panel

```vue
<MapExplorer :map-style="style" locale="en" :keep-sources="['spots']">
  <template #map><!-- your layers, PhotoPins, ClusterPopover … --></template>
  <template #header><!-- search, title --></template>
  <!-- panel content -->
  <template #footer><MapFooter locale="en" theme-key="my-site:theme" /></template>
</MapExplorer>
```

See each package's README for the details.

## Development

```bash
pnpm install
pnpm build        # build both packages
pnpm -C playground dev
```

## License

MIT
