<script setup lang="ts">
/**
 * Editor touch dell'etichetta. Usa la stessa scena Konva della stampa
 * (`render/scene.ts`), mostrata in scala per adattarsi allo schermo.
 *
 * Per restare fluido mentre si scrive, l'editor ricostruisce solo i nodi
 * degli elementi cambiati, al massimo una volta per fotogramma.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Konva, { type Group, type Layer, type Node, type Stage, type Transformer } from '@/render/konva';
import { useDocumentStore } from '@/stores/document';
import { ELEMENT_ID_ATTR, buildElementNode, elementSignature, waitForFonts } from '@/render/scene';
import { dotsToMm } from '@/model/units';
import { cssColor, effectiveTheme } from '@/theme';
import { onDiameterFontReady } from '@/render/diameter-font';
import { onWebFontReady } from '@/render/web-fonts';

const emit = defineEmits<{ edit: [id: string] }>();

const store = useDocumentStore();
const host = ref<HTMLDivElement | null>(null);

let stage: Stage | null = null;
let backgroundLayer: Layer;
let contentLayer: Layer;
let uiLayer: Layer;
let content: Group;
let transformer: Transformer;
let resizeObserver: ResizeObserver | null = null;
let isTransforming = false;
let frame = 0;
let stopFontListener: (() => void) | null = null;
let stopWebFontListener: (() => void) | null = null;
/** Nodo e firma di ogni elemento presente nella scena. */
const nodes = new Map<string, { group: Group; signature: string }>();

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
      // Bordo sottile invece di un'ombra sfocata: molto più leggero da ridisegnare.
      stroke: colors.shadow,
      strokeWidth: 1.5,
      strokeScaleEnabled: false,
      name: 'paper',
    }),
  );
  for (const z of deadZones) {
    backgroundLayer.add(new Konva.Rect({ ...z, fill: colors.deadZone, listening: false }));
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
  // Il contenuto è ritagliato sui bordi dell'etichetta.
  content.clip({ x: 0, y: 0, width: label.width, height: label.height });
}

function attachEvents(group: Group): void {
  const id = group.getAttr(ELEMENT_ID_ATTR) as string;
  group.draggable(true);
  group.on('dragstart', () => store.select(id));
  group.on('dragend', () => commitNode(group));
  group.on('transformstart', () => {
    isTransforming = true;
  });
  group.on('transformend', () => {
    isTransforming = false;
    commitNode(group);
  });
  // Primo tocco: seleziona. Tocco su un elemento già selezionato: apre la modifica.
  group.on('tap click', () => {
    if (store.selectedId === id) emit('edit', id);
    else store.select(id);
  });
}

/** Allinea la scena al modello, ricostruendo solo gli elementi cambiati. */
function syncContent(): void {
  frame = 0;
  if (!stage || isTransforming) return;
  const seen = new Set<string>();
  store.doc.elements.forEach((el, index) => {
    seen.add(el.id);
    const signature = elementSignature(el);
    const existing = nodes.get(el.id);
    if (existing && existing.signature === signature) {
      existing.group.zIndex(index);
      return;
    }
    const group = buildElementNode(el);
    attachEvents(group);
    content.add(group);
    group.zIndex(index);
    existing?.group.destroy();
    nodes.set(el.id, { group, signature });
  });
  for (const [id, entry] of nodes) {
    if (!seen.has(id)) {
      entry.group.destroy();
      nodes.delete(id);
    }
  }
  attachTransformer();
  contentLayer.batchDraw();
}

/** Raggruppa più modifiche ravvicinate (es. la digitazione) in un solo aggiornamento. */
function scheduleSync(): void {
  if (frame || typeof requestAnimationFrame === 'undefined') {
    if (!frame) syncContent();
    return;
  }
  frame = requestAnimationFrame(syncContent);
}

function rebuildAll(): void {
  for (const entry of nodes.values()) entry.group.destroy();
  nodes.clear();
  syncContent();
}

function attachTransformer(): void {
  const node = store.selectedId ? (nodes.get(store.selectedId)?.group ?? null) : null;
  transformer.nodes(node ? [node] : []);
  uiLayer.batchDraw();
}

/** Riporta posizione, dimensioni e rotazione del nodo nel modello (in mm). */
function commitNode(group: Group): void {
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

onMounted(async () => {
  if (!host.value) return;
  // Oltre 2× la differenza non si vede, ma i pixel da ridisegnare crescono molto (Pixel 7a: 2,625×).
  // Non influisce sulla stampa, che esporta sempre a 1 pixel per punto.
  Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  stage = new Konva.Stage({ container: host.value, width: 1, height: 1 });
  backgroundLayer = new Konva.Layer();
  contentLayer = new Konva.Layer();
  uiLayer = new Konva.Layer();
  content = new Konva.Group({ name: 'content' });
  contentLayer.add(content);
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
    const target = e.target as Node | Stage;
    if (target === stage || (target as Node).hasName('paper')) store.select(null);
  });

  drawBackground();
  syncContent();
  fitStage();
  resizeObserver = new ResizeObserver(() => fitStage());
  resizeObserver.observe(host.value);

  // I font possono arrivare dopo il primo disegno.
  stopFontListener = onDiameterFontReady(() => rebuildAll());
  stopWebFontListener = onWebFontReady(() => rebuildAll());
  await waitForFonts(store.doc.elements);
  rebuildAll();
});

onBeforeUnmount(() => {
  stopFontListener?.();
  stopWebFontListener?.();
  if (frame) cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  stage?.destroy();
  stage = null;
  nodes.clear();
});

watch(
  () => store.geometry,
  () => {
    if (!stage) return;
    drawBackground();
    fitStage();
  },
);

watch(
  () => store.doc.elements,
  () => scheduleSync(),
  { deep: true },
);

watch(
  () => store.selectedId,
  () => {
    if (stage) attachTransformer();
  },
);

watch(effectiveTheme, () => {
  if (!stage) return;
  drawBackground();
  applyTransformerColors();
  stage.batchDraw();
});
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
