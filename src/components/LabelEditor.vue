<script setup lang="ts">
/**
 * Editor touch dell'etichetta. Usa la stessa scena Konva della stampa
 * (`render/scene.ts`), mostrata in scala per adattarsi allo schermo.
 */
import Konva from 'konva';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { ELEMENT_ID_ATTR, buildContent, waitForFonts } from '@/render/scene';
import { dotsToMm } from '@/model/units';
import { cssColor, effectiveTheme } from '@/theme';

const emit = defineEmits<{ edit: [id: string] }>();

const store = useDocumentStore();
const host = ref<HTMLDivElement | null>(null);

let stage: Konva.Stage | null = null;
let backgroundLayer: Konva.Layer;
let contentLayer: Konva.Layer;
let uiLayer: Konva.Layer;
let transformer: Konva.Transformer;
let resizeObserver: ResizeObserver | null = null;
let isTransforming = false;
let lastTap = { id: '', at: 0 };

const PADDING = 16;

/** Colori dell'editor letti dal tema (l'etichetta resta sempre bianca). */
function themeColors() {
  return {
    selection: cssColor('--selection', '#1d4ed8'),
    outline: cssColor('--printable-outline', 'rgba(29,78,216,0.5)'),
    deadZone: cssColor('--dead-zone', 'rgba(200,60,60,0.12)'),
    shadow: cssColor('--paper-shadow', 'rgba(0,0,0,0.25)'),
  };
}

function applyTransformerColors(): void {
  const c = themeColors();
  transformer.borderStroke(c.selection);
  transformer.anchorStroke(c.selection);
  transformer.anchorFill('#ffffff');
}

function fitStage(): void {
  if (!stage || !host.value) return;
  const { label } = store.geometry;
  const w = host.value.clientWidth;
  const h = host.value.clientHeight;
  if (w <= 0 || h <= 0) return;
  const scale = Math.min((w - PADDING * 2) / label.width, (h - PADDING * 2) / label.height);
  stage.size({ width: w, height: h });
  stage.scale({ x: scale, y: scale });
  stage.position({ x: (w - label.width * scale) / 2, y: (h - label.height * scale) / 2 });
  // Le maniglie restano della stessa dimensione sullo schermo.
  transformer.anchorSize(22);
  stage.batchDraw();
}

function drawBackground(): void {
  backgroundLayer.destroyChildren();
  const { label, printable, deadZones } = store.geometry;
  const radiusDots = ((store.doc.media.cornerRadiusMm ?? 0) * 300) / 25.4;
  const colors = themeColors();
  backgroundLayer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: label.width,
      height: label.height,
      fill: '#fff',
      cornerRadius: radiusDots,
      shadowColor: colors.shadow,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowForStrokeEnabled: false,
      name: 'paper',
    }),
  );
  for (const z of deadZones) {
    backgroundLayer.add(
      new Konva.Rect({ ...z, fill: colors.deadZone, listening: false }),
    );
  }
  backgroundLayer.add(
    new Konva.Rect({
      ...printable,
      stroke: colors.outline,
      strokeWidth: 1,
      strokeScaleEnabled: false,
      dash: [6, 4],
      listening: false,
    }),
  );
}

function rebuildContent(): void {
  if (!stage || isTransforming) return;
  contentLayer.destroyChildren();
  const { label } = store.geometry;
  const clip = new Konva.Group({ clip: { x: 0, y: 0, width: label.width, height: label.height } });
  const content = buildContent(store.doc.elements);
  clip.add(content);
  contentLayer.add(clip);
  for (const node of content.getChildren()) {
    const group = node as Konva.Group;
    group.draggable(true);
    group.on('dragstart', () => {
      store.select(group.getAttr(ELEMENT_ID_ATTR) as string);
    });
    group.on('dragend', () => commitNode(group));
    group.on('transformstart', () => {
      isTransforming = true;
    });
    group.on('transformend', () => {
      isTransforming = false;
      commitNode(group);
    });
    group.on('tap click', () => onTapElement(group.getAttr(ELEMENT_ID_ATTR) as string));
  }
  attachTransformer();
  contentLayer.batchDraw();
}

function findNode(id: string | null): Konva.Group | null {
  if (!id) return null;
  return (
    (contentLayer.findOne((n: Konva.Node) => n.getAttr(ELEMENT_ID_ATTR) === id) as Konva.Group | undefined) ??
    null
  );
}

function attachTransformer(): void {
  const node = findNode(store.selectedId);
  transformer.nodes(node ? [node] : []);
  uiLayer.batchDraw();
}

/** Riporta posizione, dimensioni e rotazione del nodo nel modello (in mm). */
function commitNode(group: Konva.Group): void {
  const id = group.getAttr(ELEMENT_ID_ATTR) as string;
  const w = Math.max(10, group.width() * Math.abs(group.scaleX()));
  const h = Math.max(10, group.height() * Math.abs(group.scaleY()));
  const cx = group.x();
  const cy = group.y();
  const rotation = ((Math.round(group.rotation() * 10) / 10) % 360 + 360) % 360;
  store.updateElement(id, {
    x: dotsToMm(cx - w / 2),
    y: dotsToMm(cy - h / 2),
    width: dotsToMm(w),
    height: dotsToMm(h),
    rotation,
  });
}

function onTapElement(id: string): void {
  const now = Date.now();
  if (lastTap.id === id && now - lastTap.at < 350) {
    emit('edit', id);
    lastTap = { id: '', at: 0 };
    return;
  }
  lastTap = { id, at: now };
  store.select(id);
}

onMounted(async () => {
  if (!host.value) return;
  stage = new Konva.Stage({ container: host.value, width: 1, height: 1 });
  backgroundLayer = new Konva.Layer();
  contentLayer = new Konva.Layer();
  uiLayer = new Konva.Layer();
  stage.add(backgroundLayer, contentLayer, uiLayer);
  transformer = new Konva.Transformer({
    rotateEnabled: true,
    rotationSnaps: [0, 90, 180, 270],
    rotationSnapTolerance: 6,
    keepRatio: false,
    flipEnabled: false,
    anchorSize: 22,
    anchorCornerRadius: 11,
    rotateAnchorOffset: 36,
    padding: 2,
    ignoreStroke: true,
    boundBoxFunc: (oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox),
  });
  uiLayer.add(transformer);
  applyTransformerColors();

  stage.on('click tap', (e) => {
    const target = e.target;
    if (target === stage || target.hasName('paper')) store.select(null);
  });

  drawBackground();
  rebuildContent();
  fitStage();
  resizeObserver = new ResizeObserver(() => fitStage());
  resizeObserver.observe(host.value);

  // I font possono arrivare dopo il primo disegno.
  await waitForFonts(store.doc.elements);
  rebuildContent();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stage?.destroy();
  stage = null;
});

watch(
  () => store.geometry,
  () => {
    if (!stage) return;
    drawBackground();
    rebuildContent();
    fitStage();
  },
);

watch(
  () => store.doc.elements,
  () => rebuildContent(),
  { deep: true },
);

watch(effectiveTheme, () => {
  if (!stage) return;
  drawBackground();
  applyTransformerColors();
  stage.batchDraw();
});

watch(
  () => store.selectedId,
  () => {
    if (stage) attachTransformer();
  },
);
</script>

<template>
  <div ref="host" class="editor" data-testid="editor" aria-label="Area di lavoro dell'etichetta" />
</template>

<style scoped>
.editor {
  width: 100%;
  height: 100%;
  touch-action: none;
  overflow: hidden;
}
</style>
