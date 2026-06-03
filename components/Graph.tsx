"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { forceCollide } from "d3-force";
import type { GraphData, GNode } from "@/lib/types";
import { REL_COLORS } from "@/lib/graph";

// force-graph 는 window 의존 -> SSR 비활성화
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const nodeRadius = (n: GNode) => (n.rel === "center" ? 18 : n.kind === "word" ? 16 : 14);

export default function Graph({
  data,
  onSelect,
}: {
  data: GraphData;
  onSelect: (id: string, kind: "char" | "word") => void;
}) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // 컨테이너 크기에 맞춰 캔버스 크기 추적 (데스크톱·모바일 공통)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // react-force-graph 는 객체를 변형하므로 매번 복제본 전달
  const gdata = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data]
  );

  // 겹침 방지: 반발력 강화 + 충돌(collide) 힘 + 링크 거리
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-420).distanceMax(360);
    fg.d3Force("link")?.distance(90).strength(0.5);
    fg.d3Force("collide", forceCollide((n: any) => nodeRadius(n) + 18));
    fg.d3ReheatSimulation?.();
  }, [gdata]);

  return (
    <div ref={wrapRef} className="graphinner">
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={gdata}
        backgroundColor="#fafaf9"
        cooldownTicks={120}
        d3VelocityDecay={0.35}
        onEngineStop={() => fgRef.current?.zoomToFit(500, 50)}
        linkColor={(l: any) => REL_COLORS[l.rel as keyof typeof REL_COLORS] ?? "#cbd5e1"}
        linkWidth={2}
        onNodeClick={(n: any) => onSelect(n.id, n.kind)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const n = node as GNode & { x: number; y: number };
          const isCenter = n.rel === "center";
          const isWord = n.kind === "word";
          const color = REL_COLORS[n.rel];
          const r = nodeRadius(n);

          // 노드 원
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = isWord ? "#fff" : color;
          ctx.fill();
          ctx.lineWidth = isCenter ? 3 : 1.5;
          ctx.strokeStyle = color;
          ctx.stroke();

          // 글자 (반지름에 맞춰 고정 크기 — 줌과 무관하게 또렷)
          const fontSize = isCenter ? 20 : isWord ? 13 : 16;
          ctx.font = `700 ${fontSize}px "Noto Serif KR", serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = isWord ? "#1e293b" : "#fff";
          ctx.fillText(n.label, n.x, n.y);

          // 음/독음 라벨 (확대 시에만 — 작을 때 글자끼리 겹침 방지)
          if (n.sub && scale > 1.2) {
            ctx.font = `11px sans-serif`;
            ctx.fillStyle = "#64748b";
            ctx.fillText(n.sub, n.x, n.y + r + 9);
          }
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const n = node as GNode & { x: number; y: number };
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, nodeRadius(n) + 4, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
    </div>
  );
}
