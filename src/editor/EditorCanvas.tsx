import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Slide, SlideElement, TextElement } from '@/model/types';
import { getPreset } from '@/styles';
import { makeCtx } from '@/engine/layout/context';
import { refitText } from '@/engine/layout/textLayout';
import { useDocument } from '@/app/store';
import { SlideContent } from './SlideStage';
import { useEditor } from './store';
import { bounds, updateElements, type Rect as Box } from './ops';
import { snapBox, snapTargets, type Guide } from './snapping';
import { Rulers, RULER } from './Rulers';
import { InlineTextEditor } from './InlineTextEditor';
import { tableMetrics } from './render/TableQR';

const PAD = 48;

export function EditorCanvas() {
  const carousel = useDocument((s) => s.carousel)!;
  const plan = useDocument((s) => s.plan);
  const apply = useDocument((s) => s.apply);
  const ed = useEditor();
  const preset = getPreset(carousel.presetId);
  const W = preset.width;
  const H = preset.height;
  const slide = carousel.slides[ed.slideIndex] ?? carousel.slides[0]!;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const dragStart = useRef<Map<string, { x: number; y: number }>>(new Map());

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rulers = ed.showRulers ? RULER : 0;
  const fitZoom = Math.max(0.05, Math.min((viewport.w - PAD * 2 - rulers) / W, (viewport.h - PAD * 2 - rulers) / H));
  const zoom = ed.fit ? fitZoom : ed.zoom;
  useEffect(() => {
    if (ed.fit) useEditor.setState({ zoom: fitZoom });
  }, [ed.fit, fitZoom]);

  const stageW = Math.max(viewport.w - rulers, W * zoom + PAD * 2);
  const stageH = Math.max(viewport.h - rulers, H * zoom + PAD * 2);
  const ox = Math.round((stageW - W * zoom) / 2);
  const oy = Math.round((stageH - H * zoom) / 2);

  const safeBox = useMemo(() => {
    if (!plan || plan.slides.length !== carousel.slides.length) return null;
    try {
      const b = makeCtx(plan, carousel.presetId, carousel.theme).box;
      return { x: b.x, y: b.y, width: b.w, height: b.h };
    } catch {
      return null;
    }
  }, [plan, carousel.presetId, carousel.theme, carousel.slides.length]);

  // Attach the transformer to the selected (unlocked, visible) nodes.
  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;
    const nodes = ed.selection
      .map((id) => slide.elements.find((e) => e.id === id))
      .filter((e): e is SlideElement => Boolean(e && !e.locked && !e.hidden && e.id !== ed.editingTextId))
      .map((e) => stage.findOne(`#${e.id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [ed.selection, slide, ed.editingTextId]);

  const elementIdOf = (node: Konva.Node | null): string | null => {
    let n: Konva.Node | null = node;
    while (n && n !== stageRef.current) {
      if (n.name() === 'element') return n.id();
      n = n.getParent();
    }
    return null;
  };

  const toCanvas = (p: { x: number; y: number }) => ({ x: (p.x - ox) / zoom, y: (p.y - oy) / zoom });

  const onMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target.getParent()?.className === 'Transformer') return;
    const id = elementIdOf(e.target);
    const shift = 'shiftKey' in e.evt && (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
    if (id) {
      if (shift) ed.toggleSelect(id);
      else if (!ed.selection.includes(id)) ed.select([id]);
      return;
    }
    if (ed.editingTextId) return;
    if (!shift) ed.select([]);
    const p = toCanvas(stageRef.current!.getPointerPosition()!);
    setMarquee({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const onMouseMove = () => {
    if (!marquee) return;
    const p = toCanvas(stageRef.current!.getPointerPosition()!);
    setMarquee((m) => (m ? { ...m, width: p.x - m.x, height: p.y - m.y } : m));
  };

  const onMouseUp = () => {
    if (!marquee) return;
    const r = { x: Math.min(marquee.x, marquee.x + marquee.width), y: Math.min(marquee.y, marquee.y + marquee.height), width: Math.abs(marquee.width), height: Math.abs(marquee.height) };
    setMarquee(null);
    if (r.width < 4 && r.height < 4) return;
    const hit = slide.elements.filter((el) => {
      if (el.hidden) return false;
      const b = bounds(el);
      return b.x < r.x + r.width && r.x < b.x + b.width && b.y < r.y + r.height && r.y < b.y + b.height;
    });
    ed.select(hit.map((h) => h.id));
  };

  const onDblClick = (e: KonvaEventObject<MouseEvent>) => {
    // Double-clicking an already-selected element hits the Transformer overlay first.
    const onTransformer = e.target.getParent()?.className === 'Transformer' || e.target.className === 'Transformer';
    const id = onTransformer ? (ed.selection.length === 1 ? ed.selection[0]! : null) : elementIdOf(e.target);
    const el = id ? slide.elements.find((x) => x.id === id) : null;
    if (el?.kind === 'text' && !el.locked) {
      ed.select([el.id]);
      ed.setEditing(el.id);
    }
  };

  // ---- dragging with snapping (moves the whole selection) ----
  const onDragStart = (e: KonvaEventObject<DragEvent>) => {
    const id = elementIdOf(e.target);
    if (!id) return;
    const sel = ed.selection.includes(id) ? ed.selection : [id];
    if (!ed.selection.includes(id)) ed.select([id]);
    dragStart.current = new Map(sel.map((sid) => {
      const node = stageRef.current!.findOne(`#${sid}`);
      return [sid, { x: node?.x() ?? 0, y: node?.y() ?? 0 }];
    }));
  };

  const onDragMove = (e: KonvaEventObject<DragEvent>) => {
    const id = elementIdOf(e.target);
    const el = id && slide.elements.find((x) => x.id === id);
    if (!el || e.target.id() !== id) return;
    const start = dragStart.current.get(id);
    if (!start) return;
    let dx = e.target.x() - start.x;
    let dy = e.target.y() - start.y;
    if (ed.snap) {
      const moving = dragStart.current;
      const others = slide.elements.filter((o) => !moving.has(o.id) && !o.hidden).map(bounds);
      const b = bounds({ ...el, x: el.x + dx, y: el.y + dy });
      const s = snapBox(b, snapTargets({ width: W, height: H }, safeBox, others), 6 / zoom);
      dx += s.dx;
      dy += s.dy;
      setGuides(s.guides);
    }
    for (const [sid, p] of dragStart.current) {
      const node = sid === id ? e.target : stageRef.current!.findOne(`#${sid}`);
      node?.position({ x: p.x + dx, y: p.y + dy });
    }
  };

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const id = elementIdOf(e.target);
    if (!id || e.target.id() !== id) return;
    setGuides([]);
    const moved = new Map<string, { x: number; y: number }>();
    for (const sid of dragStart.current.keys()) {
      const node = stageRef.current!.findOne(`#${sid}`);
      if (node) moved.set(sid, { x: node.x(), y: node.y() });
    }
    dragStart.current = new Map();
    apply((d) =>
      updateElements(d, ed.slideIndex, [...moved.keys()], (el) => {
        const c = moved.get(el.id)!;
        return { ...el, x: Math.round(c.x - el.width / 2), y: Math.round(c.y - el.height / 2) };
      }),
    );
  };

  const onTransformEnd = () => {
    const tr = trRef.current!;
    const anchor = tr.getActiveAnchor() ?? '';
    const corner = /^(top|bottom)-(left|right)$/.test(anchor);
    const changes = new Map<string, { w: number; h: number; cx: number; cy: number; rot: number; sx: number; sy: number }>();
    for (const node of tr.nodes()) {
      const el = slide.elements.find((x) => x.id === node.id());
      if (!el) continue;
      const sx = node.scaleX();
      const sy = node.scaleY();
      changes.set(el.id, { w: Math.max(4, el.width * sx), h: Math.max(4, el.height * sy), cx: node.x(), cy: node.y(), rot: node.rotation(), sx, sy });
      node.scale({ x: 1, y: 1 });
    }
    apply((d) =>
      updateElements(d, ed.slideIndex, [...changes.keys()], (el) => {
        const c = changes.get(el.id)!;
        let next: SlideElement = { ...el, width: Math.round(c.w), height: Math.round(c.h), x: Math.round(c.cx - c.w / 2), y: Math.round(c.cy - c.h / 2), rotation: Math.round(c.rot * 10) / 10 };
        if (next.kind === 'text') {
          const t = next as TextElement;
          // Corner drag scales the type; side drags reflow (auto-fit text refits its size to the box).
          const scaled = corner ? { ...t, fontSize: Math.max(6, Math.round(t.fontSize * Math.sqrt(c.sx * c.sy))) } : t;
          next = refitText(scaled, corner ? scaled.fontSize : t.fontSize * (t.autoFit && !corner ? 1.6 : 1));
        }
        if (next.kind === 'table') next = { ...next, height: Math.ceil(tableMetrics(next).total) };
        if (next.kind === 'line') {
          const l = next;
          next = { ...l, points: l.points.map((v, i) => Math.round((i % 2 === 0 ? v * c.sx : v * c.sy) * 100) / 100) };
        }
        return next;
      }),
    );
  };

  const selectedEls = slide.elements.filter((e) => ed.selection.includes(e.id));
  const keepRatio = selectedEls.length > 1 || selectedEls.some((e) => ['image', 'path', 'qr', 'group'].includes(e.kind));
  const editing = ed.editingTextId ? (slide.elements.find((e) => e.id === ed.editingTextId) as TextElement | undefined) : undefined;
  const renderSlide: Slide = editing ? { ...slide, elements: slide.elements.map((e) => (e.id === editing.id ? { ...e, hidden: true } : e)) } : slide;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-zinc-200/70 dark:bg-zinc-900" data-testid="editor-canvas">
      <div className="relative" style={{ width: stageW + rulers, height: stageH + rulers }}>
        {ed.showRulers && <Rulers zoom={zoom} ox={ox} oy={oy} width={stageW} height={stageH} canvasW={W} canvasH={H} />}
        <div className="absolute" style={{ left: rulers, top: rulers }}>
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            onMouseDown={onMouseDown}
            onTouchStart={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onDblClick={onDblClick}
            onDblTap={onDblClick as never}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          >
            <Layer x={ox} y={oy} scaleX={zoom} scaleY={zoom}>
              <Rect x={-2 / zoom} y={-2 / zoom} width={W + 4 / zoom} height={H + 4 / zoom} fill="#000" opacity={0.06} listening={false} />
              <SlideContent slide={renderSlide} width={W} height={H} interactive />
            </Layer>
            <Layer x={ox} y={oy} scaleX={zoom} scaleY={zoom} listening={false}>
              {ed.showGrid && <Grid W={W} H={H} zoom={zoom} />}
              {ed.showSafe && <SafeZones W={W} H={H} zoom={zoom} safe={safeBox} platform={preset.safeZone} />}
              {guides.map((g, i) => (
                <Line key={i} points={g.orientation === 'v' ? [g.pos, -PAD, g.pos, H + PAD] : [-PAD, g.pos, W + PAD, g.pos]} stroke="#F43F5E" strokeWidth={1 / zoom} dash={[4 / zoom, 4 / zoom]} />
              ))}
              {marquee && <Rect {...marquee} fill="rgba(91,91,240,0.08)" stroke="#5B5BF0" strokeWidth={1 / zoom} />}
            </Layer>
            <Layer x={ox} y={oy} scaleX={zoom} scaleY={zoom}>
              <Transformer
                ref={trRef}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                rotationSnapTolerance={4}
                keepRatio={keepRatio}
                anchorSize={9}
                anchorCornerRadius={2}
                borderStroke="#5B5BF0"
                anchorStroke="#5B5BF0"
                ignoreStroke
                flipEnabled={false}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
                onTransformEnd={onTransformEnd}
              />
            </Layer>
          </Stage>
          {editing && <InlineTextEditor el={editing} zoom={zoom} ox={ox} oy={oy} slideIndex={ed.slideIndex} />}
        </div>
      </div>
    </div>
  );
}

function Grid({ W, H, zoom }: { W: number; H: number; zoom: number }) {
  const step = Math.round(W / 12);
  const lines = [];
  for (let x = step; x < W; x += step) lines.push(<Line key={`v${x}`} points={[x, 0, x, H]} stroke="#5B5BF0" opacity={0.25} strokeWidth={1 / zoom} />);
  for (let y = step; y < H; y += step) lines.push(<Line key={`h${y}`} points={[0, y, W, y]} stroke="#5B5BF0" opacity={0.25} strokeWidth={1 / zoom} />);
  return <>{lines}</>;
}

function SafeZones({ W, H, zoom, safe, platform }: { W: number; H: number; zoom: number; safe: Box | null; platform: { top: number; right: number; bottom: number; left: number } }) {
  return (
    <>
      {safe && <Rect {...safe} stroke="#0EA5E9" strokeWidth={1.5 / zoom} dash={[8 / zoom, 6 / zoom]} />}
      <Rect x={platform.left} y={platform.top} width={W - platform.left - platform.right} height={H - platform.top - platform.bottom} stroke="#F59E0B" strokeWidth={1.5 / zoom} dash={[3 / zoom, 5 / zoom]} />
    </>
  );
}
