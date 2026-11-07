// DOM rulers along the top/left of the canvas; ticks in output pixels.
export const RULER = 22;

export function Rulers({ zoom, ox, oy, width, height, canvasW, canvasH }: { zoom: number; ox: number; oy: number; width: number; height: number; canvasW: number; canvasH: number }) {
  const step = zoom > 0.6 ? 50 : zoom > 0.3 ? 100 : 200;
  const ticks = (len: number) => Array.from({ length: Math.floor(len / step) + 1 }, (_, i) => i * step);
  return (
    <>
      <svg className="pointer-events-none z-10 block bg-zinc-100 text-zinc-500 dark:bg-zinc-800" width={width} height={RULER} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
        {ticks(canvasW).map((t) => (
          <g key={t} transform={`translate(${RULER + ox + t * zoom},0)`}>
            <line y1={t % (step * 2) === 0 ? 8 : 14} y2={RULER} stroke="currentColor" strokeWidth={1} />
            {t % (step * 2) === 0 && <text x={3} y={10} fontSize={9} fill="currentColor">{t}</text>}
          </g>
        ))}
      </svg>
      <svg className="pointer-events-none z-10 block bg-zinc-100 text-zinc-500 dark:bg-zinc-800" width={RULER} height={height} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
        {ticks(canvasH).map((t) => (
          <g key={t} transform={`translate(0,${RULER + oy + t * zoom})`}>
            <line x1={t % (step * 2) === 0 ? 8 : 14} x2={RULER} stroke="currentColor" strokeWidth={1} />
            {t % (step * 2) === 0 && <text x={0} y={0} fontSize={9} fill="currentColor" transform="translate(10,-3) rotate(-90)">{t}</text>}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-0 top-0 z-10 bg-zinc-200 dark:bg-zinc-700" style={{ width: RULER, height: RULER }} />
    </>
  );
}
