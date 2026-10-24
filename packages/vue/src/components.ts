// 放在 <MapView> 里的控件与标记：都只是把 @mapette/core 的对象接到组件生命周期上，不渲染任何 DOM。
import { ClusterExpander, kitText, LocationMarker as CoreLocationMarker, MapButtons, PhotoPins as CorePhotoPins, ScaleBar as CoreScaleBar, type MapButtonsOptions, type PhotoPinsOptions } from "@mapette/core";
import type { MapGeoJSONFeature } from "maplibre-gl";
import { defineComponent, watch, type PropType } from "vue";
import { useMap, useMapObject } from "./context";

export const ScaleBar = defineComponent({
  name: "ScaleBar",
  props: { max: { type: Number, default: 100 } },
  setup(props) {
    useMapObject((ctrl) => new CoreScaleBar(ctrl, props.max));
    return () => null;
  },
});

export const MapControls = defineComponent({
  name: "MapControls",
  props: {
    locate: { type: Boolean, default: true },
    zoom: { type: Boolean, default: true },
    labels: Object as PropType<MapButtonsOptions["labels"]>,
  },
  setup(props, { expose }) {
    const { locale } = useMap();
    // 不给 labels 就按地图的语言用自带的文字
    const buttons = useMapObject((ctrl) => new MapButtons(ctrl, { locate: props.locate, zoom: props.zoom, labels: props.labels ?? kitText(locale.value) }));
    expose({ locate: () => buttons.value?.locate() });
    return () => null;
  },
});

export const LocationMarker = defineComponent({
  name: "LocationMarker",
  props: {
    lngLat: { type: Array as unknown as PropType<[number, number]>, required: true },
    pulse: Boolean,
  },
  setup(props) {
    const marker = useMapObject((ctrl) => new CoreLocationMarker(ctrl, props.lngLat, { pulse: props.pulse }));
    watch(() => props.lngLat, (p) => marker.value?.setLngLat(p));
    return () => null;
  },
});

type Key = string | number;

export const PhotoPins = defineComponent({
  name: "PhotoPins",
  props: {
    layers: { type: Array as PropType<string[]>, required: true },
    images: { type: Function as PropType<PhotoPinsOptions["images"]>, required: true },
    featureKey: Function as PropType<PhotoPinsOptions["featureKey"]>,
    /** 高亮的点（键） */
    focus: { type: [String, Number] as PropType<Key | null>, default: null },
    minZoom: Number,
    max: Number,
    gap: Number,
  },
  emits: { pick: (_feature: MapGeoJSONFeature, _key: Key) => true },
  setup(props, { emit, expose }) {
    const pins = useMapObject((ctrl) => {
      const p = new CorePhotoPins(ctrl, {
        layers: props.layers,
        images: props.images,
        featureKey: props.featureKey,
        minZoom: props.minZoom,
        max: props.max,
        gap: props.gap,
        onPick: (f, key) => emit("pick", f, key),
      });
      p.setFocus(props.focus);
      return p;
    });
    watch(() => props.focus, (key) => pins.value?.setFocus(key));
    expose({ refresh: () => pins.value?.refresh() });
    return () => null;
  },
});

/** 点击聚合气泡放大展开；layers 是 clusterLayers 生成的气泡图层（默认 cluster 与 cluster-count） */
export const ClusterExpand = defineComponent({
  name: "ClusterExpand",
  props: { layers: { type: Array as PropType<string[]>, default: () => ["cluster", "cluster-count"] } },
  setup(props) {
    useMapObject((ctrl) => new ClusterExpander(ctrl, props.layers));
    return () => null;
  },
});
