"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type LessonNode = {
  id: string;
  type: "box" | "circle" | "text" | "arrow";
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  accent?: string;
  order: number;
  selected?: boolean;
};
export type LessonConnection = {
  from: string;
  to: string;
  label?: string;
  order: number;
};
export type ImportedSvgDrawing = {
  viewBox: string;
  paths: { d: string; color: string; width: number }[];
  previewData?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};
export type VisualLessonSpec = {
  mode: "diagram" | "code" | "split";
  eyebrow?: string;
  content?: {
    heading?: string;
    items: {
      number: number;
      title: string;
      description: string;
      codeLines?: number[];
    }[];
  };
  diagram?: {
    nodes: LessonNode[];
    connections: LessonConnection[];
    showHand?: boolean;
    importedSvg?: ImportedSvgDrawing;
    selectedText?: "title" | "bullets";
    textLayout?: {
      titleX?: number;
      titleY?: number;
      bulletsX?: number;
      bulletsY?: number;
    };
  };
  code?: {
    language: string;
    filename?: string;
    source?: string;
    files?: { filename: string; source: string }[];
    output?: string;
    bullets?: string[];
    typingSpeed?: number;
    showLineNumbers?: boolean;
    highlights?: { lines: number[]; number: number; accent?: string }[];
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const DIAGRAM_OFFSET_Y = 105;
function MarkerStroke({
  path,
  begin,
  duration,
  size = 145,
}: {
  path: string;
  begin: number;
  duration: number;
  size?: number;
}) {
  return (
    <g className="syncedDrawingHand" opacity="0">
      <image
        href="/assets/drawing-hand.png"
        x={-size * 0.12}
        y={-size * 0.08}
        width={size}
        height={size * 1.52}
        preserveAspectRatio="xMinYMin meet"
      />
      <animateMotion
        dur={`${duration}s`}
        begin={`${begin}s`}
        path={path}
        fill="freeze"
        calcMode="paced"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;.025;.96;1"
        dur={`${duration}s`}
        begin={`${begin}s`}
        fill="freeze"
      />
    </g>
  );
}
function writingPath(start: number, end: number, y: number, text: string) {
  const steps = Math.max(8, Math.min(42, text.length)),
    wave = [0, -2.2, 1.7, -1.1, 2.4, -0.7, 1.2];
  let path = `M ${start} ${y}`;
  for (let index = 1; index <= steps; index++) {
    const progress = index / steps,
      x = start + (end - start) * progress,
      yy = y + wave[index % wave.length];
    path += ` L ${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return path;
}
function nodeStrokePath(node: LessonNode) {
  const x = node.x * 10,
    y = node.y * 5.2 + DIAGRAM_OFFSET_Y,
    w = (node.width || 20) * 10,
    h = (node.height || 18) * 5.2;
  if (node.type === "arrow")
    return `M ${x - w / 2} ${y} L ${x + w / 2} ${y} M ${x + w / 2 - 18} ${y - h * 0.22} L ${x + w / 2} ${y} L ${x + w / 2 - 18} ${y + h * 0.22}`;
  if (node.type === "circle")
    return `M ${x - w / 2} ${y} A ${w / 2} ${h / 2} 0 1 0 ${x + w / 2} ${y} A ${w / 2} ${h / 2} 0 1 0 ${x - w / 2} ${y}`;
  const left = x - w / 2,
    right = x + w / 2,
    top = y - h / 2,
    bottom = y + h / 2,
    r = Math.min(18, w / 5, h / 5);
  return `M ${left + r} ${top} L ${right - r} ${top} Q ${right} ${top} ${right} ${top + r} L ${right} ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} L ${left + r} ${bottom} Q ${left} ${bottom} ${left} ${bottom - r} L ${left} ${top + r} Q ${left} ${top} ${left + r} ${top}`;
}
function connectionStrokePath(from: LessonNode, to: LessonNode) {
  const x1 = from.x * 10,
    y1 = from.y * 5.2 + DIAGRAM_OFFSET_Y,
    x2 = to.x * 10,
    y2 = to.y * 5.2 + DIAGRAM_OFFSET_Y,
    mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2} M ${x2 - 13} ${y2 - 8} L ${x2} ${y2} L ${x2 - 13} ${y2 + 8}`;
}

export default function VisualLessonScene({
  lesson,
  title,
  body,
  presenting = false,
  editable = false,
  onImportedChange,
  onDiagramChange,
}: {
  lesson: VisualLessonSpec;
  title?: string;
  body?: string;
  presenting?: boolean;
  editable?: boolean;
  onImportedChange?: (patch: Partial<ImportedSvgDrawing>) => void;
  onDiagramChange?: (diagram: NonNullable<VisualLessonSpec["diagram"]>) => void;
}) {
  const files =
      lesson.code?.files?.length
        ? lesson.code.files
        : [
            {
              filename: lesson.code?.filename || "App.jsx",
              source: lesson.code?.source || "",
            },
          ],
    [activeFile, setActiveFile] = useState(0),
    [fileAnimationKey, setFileAnimationKey] = useState(0),
    [previewOpen, setPreviewOpen] = useState(false),
    source = files[Math.min(activeFile, files.length - 1)]?.source || "",
    [visible, setVisible] = useState(
      presenting && lesson.mode === "code" ? 0 : source.length,
    );
  useEffect(() => {
    if (lesson.mode !== "code" || !presenting) {
      setVisible(source.length);
      return;
    }
    setVisible(0);
    const speed = clamp(lesson.code?.typingSpeed || 24, 8, 80),
      timer = window.setInterval(
        () =>
          setVisible((value) => {
            if (value >= source.length) {
              window.clearInterval(timer);
              return value;
            }
            return Math.min(source.length, value + 2);
          }),
        speed,
      );
    return () => {
      window.clearInterval(timer);
    };
  }, [lesson.mode, lesson.code?.typingSpeed, source, presenting, fileAnimationKey]);
  useEffect(() => {
    if (presenting && lesson.mode === "code") setActiveFile(0);
  }, [presenting, lesson.mode]);
  useEffect(() => {
    if (lesson.mode === "code") setPreviewOpen(false);
  }, [lesson]);
  const nodes = lesson.diagram?.nodes || [],
    nodeMap = useMemo(
      () => new Map(nodes.map((node) => [node.id, node])),
      [nodes],
    ),
    dragRef = useRef<{
      x: number;
      y: number;
      nodes: Map<string, { x: number; y: number }>;
    } | null>(null),
    textDragRef = useRef<{
      kind: "title" | "bullets";
      x: number;
      y: number;
      originX: number;
      originY: number;
    } | null>(null);
  const teachingPoints = (body || "")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((point) =>
      /[.!?]$/.test(point.trim()) ? point.trim() : `${point.trim()}.`,
    );
  const textLayout = lesson.diagram?.textLayout || {},
    titleX = textLayout.titleX ?? 7,
    titleY = textLayout.titleY ?? 12.5,
    bulletsX = textLayout.bulletsX ?? 8.2,
    bulletsY = textLayout.bulletsY ?? 21;
  const importedViewBox = lesson.diagram?.importedSvg?.viewBox
      .split(/\s+/)
      .map(Number),
    importedHandSize =
      importedViewBox?.length === 4
        ? Math.max(2, Math.min(importedViewBox[2], importedViewBox[3]) * 0.18)
        : 145;
  const imported = lesson.diagram?.importedSvg,
    svgX = imported?.x ?? 50,
    svgY = imported?.y ?? 65,
    svgW = imported?.width ?? 74,
    svgH = imported?.height ?? 58,
    svgLeft = (svgX - svgW / 2) * 10,
    svgTop = (svgY - svgH / 2) * 5.6,
    svgWidth = svgW * 10,
    svgHeight = svgH * 5.6;
  const svgStep = imported
      ? Math.max(0.16, Math.min(1.3, 14 / Math.max(1, imported.paths.length)))
      : 1.3,
    svgDuration = Math.max(0.16, Math.min(1.18, svgStep * 0.92)),
    svgFinish = imported
      ? 4.13 + Math.max(0, imported.paths.length - 1) * svgStep + svgDuration
      : 4.13;
  const moveImported = (clientX: number, clientY: number) => {
      const frame = document
        .querySelector(".editor .slide")
        ?.getBoundingClientRect();
      if (frame)
        onImportedChange?.({
          x: Math.max(
            svgW / 2,
            Math.min(
              100 - svgW / 2,
              ((clientX - frame.left) / frame.width) * 100,
            ),
          ),
          y: Math.max(
            svgH / 2,
            Math.min(
              100 - svgH / 2,
              ((clientY - frame.top) / frame.height) * 100,
            ),
          ),
        });
    },
    resizeImported = (clientX: number, clientY: number) => {
      const frame = document
        .querySelector(".editor .slide")
        ?.getBoundingClientRect();
      if (!frame) return;
      const px = ((clientX - frame.left) / frame.width) * 100,
        py = ((clientY - frame.top) / frame.height) * 100;
      onImportedChange?.({
        width: Math.max(15, Math.min(100, Math.abs(px - svgX) * 2)),
        height: Math.max(15, Math.min(100, Math.abs(py - svgY) * 2)),
      });
    };
  const pointerPosition = (clientX: number, clientY: number) => {
      const frame = document
        .querySelector(".editor .slide")
        ?.getBoundingClientRect();
      if (!frame) return null;
      return {
        x: clamp(((clientX - frame.left) / frame.width) * 100, 3, 97),
        y: clamp(
          (((clientY - frame.top) / frame.height) * 560 - DIAGRAM_OFFSET_Y) /
            5.2,
          4,
          86,
        ),
      };
    },
    patchNode = (id: string, patch: Partial<LessonNode>) =>
      onDiagramChange?.({
        ...lesson.diagram!,
        nodes: nodes.map((node) =>
          node.id === id ? { ...node, ...patch } : node,
        ),
      }),
    selectNode = (id: string, toggle: boolean) => {
      const current = nodes.find((node) => node.id === id),
        willSelect = toggle ? !current?.selected : true;
      onDiagramChange?.({
        ...lesson.diagram!,
        nodes: nodes.map((node) => ({
          ...node,
          selected: toggle
            ? node.id === id
              ? willSelect
              : node.selected
            : node.id === id,
        })),
      });
    },
    beginNodeDrag = (id: string, clientX: number, clientY: number) => {
      const point = pointerPosition(clientX, clientY);
      if (!point) return;
      const active = nodes.filter((node) => node.selected || node.id === id);
      dragRef.current = {
        ...point,
        nodes: new Map(
          active.map((node) => [node.id, { x: node.x, y: node.y }]),
        ),
      };
    },
    moveNode = (clientX: number, clientY: number) => {
      const point = pointerPosition(clientX, clientY),
        drag = dragRef.current;
      if (!point || !drag) return;
      const dx = point.x - drag.x,
        dy = point.y - drag.y;
      onDiagramChange?.({
        ...lesson.diagram!,
        nodes: nodes.map((node) => {
          const start = drag.nodes.get(node.id);
          return start
            ? {
                ...node,
                x: clamp(start.x + dx, 3, 97),
                y: clamp(start.y + dy, 4, 86),
              }
            : node;
        }),
      });
    },
    resizeNode = (node: LessonNode, clientX: number, clientY: number) => {
      const point = pointerPosition(clientX, clientY);
      if (point)
        patchNode(node.id, {
          width: clamp(Math.abs(point.x - node.x) * 2, 6, 80),
          height: clamp(Math.abs(point.y - node.y) * 2, 6, 70),
        });
    };
  const canvasPosition = (clientX: number, clientY: number) => {
      const frame = document
        .querySelector(".editor .slide")
        ?.getBoundingClientRect();
      if (!frame) return null;
      return {
        x: clamp(((clientX - frame.left) / frame.width) * 100, 2, 96),
        y: clamp(((clientY - frame.top) / frame.height) * 100, 3, 94),
      };
    },
    selectText = (kind: "title" | "bullets") =>
      onDiagramChange?.({
        ...lesson.diagram!,
        selectedText: kind,
        nodes: nodes.map((node) => ({ ...node, selected: false })),
      }),
    beginTextDrag = (
      kind: "title" | "bullets",
      clientX: number,
      clientY: number,
    ) => {
      const point = canvasPosition(clientX, clientY);
      if (!point) return;
      textDragRef.current = {
        kind,
        ...point,
        originX: kind === "title" ? titleX : bulletsX,
        originY: kind === "title" ? titleY : bulletsY,
      };
    },
    moveText = (clientX: number, clientY: number) => {
      const point = canvasPosition(clientX, clientY),
        drag = textDragRef.current;
      if (!point || !drag) return;
      const x = clamp(drag.originX + point.x - drag.x, 2, 92),
        y = clamp(drag.originY + point.y - drag.y, 4, 88);
      onDiagramChange?.({
        ...lesson.diagram!,
        textLayout: {
          ...textLayout,
          ...(drag.kind === "title"
            ? { titleX: x, titleY: y }
            : { bulletsX: x, bulletsY: y }),
        },
      });
    };
  const [writtenTitle, setWrittenTitle] = useState(
      presenting ? "" : title || "",
    ),
    [writtenPoints, setWrittenPoints] = useState<string[]>(
      presenting ? teachingPoints.map(() => "") : teachingPoints,
    );
  useEffect(() => {
    if (lesson.mode !== "diagram" || !presenting) {
      setWrittenTitle(title || "");
      setWrittenPoints(teachingPoints);
      return;
    }
    setWrittenTitle("");
    setWrittenPoints(teachingPoints.map(() => ""));
    const started = performance.now(),
      timer = window.setInterval(() => {
        const elapsed = performance.now() - started,
          titleStart = 480,
          titleDuration = 1380;
        setWrittenTitle(
          (title || "").slice(
            0,
            Math.max(
              0,
              Math.min(
                (title || "").length,
                Math.floor(
                  ((elapsed - titleStart) / titleDuration) *
                    (title || "").length,
                ),
              ),
            ),
          ),
        );
        setWrittenPoints(
          teachingPoints.map((point, index) => {
            const start = 2030 + index * 1020,
              duration = 780,
              count = Math.max(
                0,
                Math.min(
                  point.length,
                  Math.floor(((elapsed - start) / duration) * point.length),
                ),
              );
            return point.slice(0, count);
          }),
        );
        if (elapsed > 2030 + teachingPoints.length * 1020) {
          window.clearInterval(timer);
        }
      }, 20);
    return () => window.clearInterval(timer);
  }, [lesson.mode, presenting, title, body]);
  const lineEnd = (
    text: string,
    start: number,
    averageCharacterWidth: number,
  ) => Math.min(930, start + text.length * averageCharacterWidth);
  if (lesson.mode === "split") {
    const splitSource = lesson.code?.source || lesson.code?.files?.[0]?.source || "",
      splitLines = splitSource.split("\n"),
      items = lesson.content?.items || [],
      highlightForLine = (line: number) =>
        lesson.code?.highlights?.find((highlight) => highlight.lines.includes(line));
    return (
      <div className={`visualLesson splitLesson ${presenting ? "isPresenting" : "isStatic"}`}>
        <section className="splitContent">
          <small>{lesson.eyebrow}</small>
          <h2>{lesson.content?.heading}</h2>
          <ol>
            {items.map((item, index) => (
              <li key={`${item.number}-${item.title}`} style={{ "--reveal": index } as React.CSSProperties}>
                <b>{item.number}</b>
                <span><strong>{item.title}</strong><em>{item.description.replaceAll("`", "")}</em></span>
              </li>
            ))}
          </ol>
        </section>
        <section className="splitCodeWindow">
          <header><span>{lesson.code?.filename || "Component.jsx"}</span><em>{lesson.code?.language}</em></header>
          <pre>
            {splitLines.map((line, index) => {
              const lineNumber = index + 1,
                highlight = highlightForLine(lineNumber);
              return (
                <span className={highlight ? "highlighted" : ""} key={lineNumber} style={highlight ? { "--line-accent": highlight.accent || "#2f9e73" } as React.CSSProperties : undefined}>
                  {lesson.code?.showLineNumbers !== false && <i>{lineNumber}</i>}
                  <code>{line || " "}</code>
                  {highlight && <b>{highlight.number}</b>}
                </span>
              );
            })}
          </pre>
        </section>
      </div>
    );
  }
  if (lesson.mode === "diagram")
    return (
      <div
        className={`visualLesson diagramLesson ${presenting ? "isPresenting" : "isStatic"}`}
      >
        <svg
          className="lessonSketch"
          viewBox="0 0 1000 560"
          role="img"
          aria-label="Animated handwritten concept explanation"
        >
          <g
            className={editable ? "editableTextGroup" : ""}
            onPointerDown={(event) => {
              if (!editable) return;
              selectText("title");
              beginTextDrag("title", event.clientX, event.clientY);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (editable && event.buttons === 1) moveText(event.clientX, event.clientY);
            }}
            onPointerUp={() => (textDragRef.current = null)}
          >
            <rect className="textHitArea" x={titleX * 10 - 10} y={titleY * 5.6 - 35} width="820" height="54" />
            <text className="writtenHeading" x={titleX * 10} y={titleY * 5.6}>{writtenTitle}</text>
            {editable && lesson.diagram?.selectedText === "title" && <rect className="textSelection" x={titleX * 10 - 8} y={titleY * 5.6 - 34} width="815" height="52" />}
          </g>
          <g
            className={editable ? "editableTextGroup" : ""}
            onPointerDown={(event) => {
              if (!editable) return;
              selectText("bullets");
              beginTextDrag("bullets", event.clientX, event.clientY);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (editable && event.buttons === 1) moveText(event.clientX, event.clientY);
            }}
            onPointerUp={() => (textDragRef.current = null)}
          >
            <rect className="textHitArea" x={bulletsX * 10 - 10} y={bulletsY * 5.6 - 23} width="850" height={Math.max(48, teachingPoints.length * 34 + 12)} />
            {teachingPoints.map((point, index) => (
              <text className="writtenPoint" key={point} x={bulletsX * 10} y={bulletsY * 5.6 + index * 34}>
                {writtenPoints[index] && <tspan className="writtenBullet">•</tspan>} {writtenPoints[index]}
              </text>
            ))}
            {editable && lesson.diagram?.selectedText === "bullets" && <rect className="textSelection" x={bulletsX * 10 - 8} y={bulletsY * 5.6 - 22} width="845" height={Math.max(46, teachingPoints.length * 34 + 8)} />}
          </g>
          {lesson.diagram?.connections.map((connection) => {
            const from = nodeMap.get(connection.from),
              to = nodeMap.get(connection.to);
            if (!from || !to) return null;
            const x1 = from.x * 10,
              y1 = from.y * 5.2 + DIAGRAM_OFFSET_Y,
              x2 = to.x * 10,
              y2 = to.y * 5.2 + DIAGRAM_OFFSET_Y,
              midX = (x1 + x2) / 2;
            return (
              <g
                key={`${connection.from}-${connection.to}`}
                style={
                  { "--draw-order": connection.order } as React.CSSProperties
                }
              >
                <path
                  className="sketchConnector sketchStroke"
                  pathLength="1"
                  d={connectionStrokePath(from, to)}
                />
                {connection.label && (
                  <text
                    className="connectorLabel"
                    x={midX}
                    y={(y1 + y2) / 2 - 10}
                  >
                    {connection.label}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((node) => {
            const x = node.x * 10,
              y = node.y * 5.2 + DIAGRAM_OFFSET_Y,
              w = (node.width || 20) * 10,
              h = (node.height || 18) * 5.2,
              accent = node.accent || "#e85d3f",
              selected = editable && !!node.selected;
            return (
              <g
                key={node.id}
                className={`sketchNode ${editable ? "editableNode" : ""} ${selected ? "selectedNode" : ""}`}
                style={
                  {
                    "--draw-order": node.order,
                    "--node-accent": accent,
                  } as React.CSSProperties
                }
                onPointerDown={(event) => {
                  if (!editable) return;
                  const modifier =
                    event.shiftKey || event.metaKey || event.ctrlKey;
                  if (modifier || !node.selected) selectNode(node.id, modifier);
                  beginNodeDrag(node.id, event.clientX, event.clientY);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (
                    editable &&
                    event.buttons === 1 &&
                    event.currentTarget.hasPointerCapture(event.pointerId)
                  )
                    moveNode(event.clientX, event.clientY);
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
              >
                <rect
                  className="nodeHitArea"
                  x={x - w / 2 - 10}
                  y={y - h / 2 - 10}
                  width={w + 20}
                  height={h + 20}
                />
                {node.type !== "text" && (
                  <path
                    className="sketchStroke"
                    pathLength="1"
                    d={nodeStrokePath(node)}
                  />
                )}
                <text x={x} y={y + 6} textAnchor="middle">
                  {node.label}
                </text>
                {selected && (
                  <>
                    <rect
                      className="nodeSelection"
                      x={x - w / 2 - 7}
                      y={y - h / 2 - 7}
                      width={w + 14}
                      height={h + 14}
                    />
                    <circle
                      className="nodeResizeHandle"
                      cx={x + w / 2 + 7}
                      cy={y + h / 2 + 7}
                      r="9"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (
                          event.buttons === 1 &&
                          event.currentTarget.hasPointerCapture(event.pointerId)
                        )
                          resizeNode(node, event.clientX, event.clientY);
                      }}
                    />
                  </>
                )}
              </g>
            );
          })}
          {imported?.previewData && (
            <image
              className={`importedSvgPreview ${presenting ? "presenting" : ""}`}
              href={imported.previewData}
              x={svgLeft}
              y={svgTop}
              width={svgWidth}
              height={svgHeight}
              preserveAspectRatio="xMidYMid meet"
              style={{ "--svg-finish": `${svgFinish}s` } as React.CSSProperties}
            />
          )}
          {imported && (
            <svg
              className={`importedSvgDrawing ${editable ? "editable" : ""} ${imported.previewData && !presenting ? "previewOnly" : ""}`}
              x={svgLeft}
              y={svgTop}
              width={svgWidth}
              height={svgHeight}
              viewBox={imported.viewBox}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={(event) => {
                if (editable)
                  event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (
                  editable &&
                  event.buttons === 1 &&
                  event.currentTarget.hasPointerCapture(event.pointerId)
                )
                  moveImported(event.clientX, event.clientY);
              }}
            >
              {imported.paths.map((path, index) => (
                <path
                  key={index}
                  className={presenting ? "importedSvgStroke" : ""}
                  pathLength="1"
                  d={path.d}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={
                    {
                      "--svg-delay": `${4.13 + index * svgStep}s`,
                      "--svg-duration": `${svgDuration}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
              {presenting &&
                lesson.diagram?.showHand !== false &&
                imported.paths.map((path, index) => (
                  <MarkerStroke
                    key={`svg-hand-${index}`}
                    path={path.d}
                    begin={4.05 + index * svgStep}
                    duration={svgDuration}
                    size={importedHandSize}
                  />
                ))}
            </svg>
          )}
          {imported && editable && (
            <g className="importedSvgSelection">
              <rect
                x={svgLeft}
                y={svgTop}
                width={svgWidth}
                height={svgHeight}
              />
              <circle
                cx={svgLeft + svgWidth}
                cy={svgTop + svgHeight}
                r="9"
                onPointerDown={(event) =>
                  event.currentTarget.setPointerCapture(event.pointerId)
                }
                onPointerMove={(event) => {
                  if (
                    event.buttons === 1 &&
                    event.currentTarget.hasPointerCapture(event.pointerId)
                  )
                    resizeImported(event.clientX, event.clientY);
                }}
              />
            </g>
          )}
          {presenting && lesson.diagram?.showHand !== false && (
            <>
              <MarkerStroke
                path={writingPath(
                  titleX * 10,
                  lineEnd(title || "", titleX * 10, 21),
                  titleY * 5.6,
                  title || "",
                )}
                begin={0.35}
                duration={1.45}
              />
              {teachingPoints.map((point, index) => (
                <MarkerStroke
                  key={`hand-${point}`}
                  path={writingPath(
                    bulletsX * 10,
                    lineEnd(`• ${point}`, bulletsX * 10, 9.4),
                    bulletsY * 5.6 + index * 34,
                    point,
                  )}
                  begin={1.9 + index * 1.02}
                  duration={0.88}
                />
              ))}
              {[
                ...nodes.map((node) => ({
                  order: node.order,
                  path: nodeStrokePath(node),
                })),
                ...(lesson.diagram?.connections || []).flatMap((connection) => {
                  const from = nodeMap.get(connection.from),
                    to = nodeMap.get(connection.to);
                  return from && to
                    ? [
                        {
                          order: connection.order,
                          path: connectionStrokePath(from, to),
                        },
                      ]
                    : [];
                }),
              ]
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <MarkerStroke
                    key={`diagram-hand-${item.order}`}
                    path={item.path}
                    begin={4 + item.order * 1.05}
                    duration={1.15}
                  />
                ))}
            </>
          )}
        </svg>
        <div className="drawTimeline">
          <i />
          <span>Write → explain → draw</span>
        </div>
      </div>
    );
  const displayed = source.slice(0, visible),
    lines = displayed.split("\n"),
    fileDone = visible >= source.length,
    done = fileDone,
    activeFilename = files[Math.min(activeFile, files.length - 1)]?.filename || "",
    canRunPreview =
      /(^|\/)app\.jsx$/i.test(activeFilename) &&
      /react|jsx/i.test(lesson.code?.language || "");
  return (
    <div
      className={`visualLesson codeLesson ${previewOpen ? "previewOpen" : "previewClosed"} ${presenting ? "isPresenting" : "isStatic"}`}
    >
      <section className="lessonCodeWindow">
        <header>
          <i />
          <i />
          <i />
          <nav className="codeFileTabs" aria-label="Code files">
            {files.map((file, index) => (
              <button
                className={index === activeFile ? "active" : ""}
                key={`${file.filename}-${index}`}
                onClick={() => {
                  setActiveFile(index);
                  setPreviewOpen(false);
                  if (presenting) {
                    setVisible(0);
                    setFileAnimationKey((key) => key + 1);
                  } else setVisible(file.source.length);
                }}
              >
                {file.filename}
              </button>
            ))}
          </nav>
          <em>{lesson.code?.language}</em>
          {canRunPreview && (
            <button
              className="codeRunButton"
              onClick={() => setPreviewOpen((open) => !open)}
              disabled={!done}
            >
              {previewOpen ? "Hide output" : done ? "Run ▶" : "Typing…"}
            </button>
          )}
        </header>
        <pre>
          {lines.map((line, index) => (
            <span key={index}>
              <i>{index + 1}</i>
              <code>{line || " "}</code>
              {index === lines.length - 1 && !fileDone && (
                <b className="typeCursor" />
              )}
            </span>
          ))}
        </pre>
        <footer>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span>Ln {lines.length}</span>
        </footer>
      </section>
      {previewOpen && canRunPreview && (
      <section className={`lessonOutput ${done ? "ready" : "waiting"}`}>
        <header>
          <span>React preview</span>
          <b>● LIVE</b>
        </header>
        <div>
          <strong>
            {done ? lesson.code?.output : "Waiting for the component…"}
          </strong>
        </div>
      </section>
      )}
      {!!lesson.code?.bullets?.length && (
        <ul className="lessonBullets">
          {lesson.code.bullets.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
