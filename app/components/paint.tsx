"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

import {
  PenIcon,
  BrushCleaningIcon,
  PaintBucketIcon,
  HandIcon,
  Undo2Icon,
  Redo2Icon,
  ImageUpscaleIcon,
  DownloadIcon,
  Grid2X2Icon,
  SquareIcon,
  Grid3X3Icon,
  CircleIcon,
  RectangleHorizontalIcon,
  DiamondIcon,
  // Add Trash2Icon for clear canvas
  Trash2Icon,
} from "lucide-react";

const DEFAULT_GRID_WIDTH = 16;
const DEFAULT_GRID_HEIGHT = 16;
const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 64;

const INITIAL_TAILWIND_COLORS = [
  "bg-black",
  "bg-red-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-white",
];
const DEFAULT_COLOR = "bg-black";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

const EXPORT_MIN = 16;
const EXPORT_MAX = 1600;
const EXPORT_STEP = 16;
const EXPORT_DEFAULT = 512;

const SIZE_OPTIONS = [1, 2, 3];
const DEFAULT_SIZE = 1;

type ShapeType = "rectangle" | "square" | "circle" | "rhombus";
const SHAPE_OPTIONS: { type: ShapeType; label: string; icon: React.ReactNode }[] = [
  { type: "rectangle", label: "Rectangle", icon: <RectangleHorizontalIcon size={26} /> },
  { type: "square", label: "Square", icon: <SquareIcon size={26} /> },
  { type: "circle", label: "Circle", icon: <CircleIcon size={26} /> },
  { type: "rhombus", label: "Rhombus", icon: <DiamondIcon size={26} /> },
];

function createGrid(width: number, height: number) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "transparent")
  );
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function tailwindClassToHex(cls: string): string {
  if (cls.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(cls)) {
    return cls;
  }
  switch (cls) {
    case "bg-black":
      return "#000000";
    case "bg-white":
      return "#ffffff";
    case "bg-red-500":
      return "#ef4444";
    case "bg-green-500":
      return "#22c55e";
    case "bg-blue-500":
      return "#3b82f6";
    case "bg-yellow-500":
      return "#eab308";
    case "bg-pink-500":
      return "#ec4899";
    case "bg-cyan-500":
      return "#06b6d4";
    default:
      return "#000000";
  }
}

type Tool = "pen" | "eraser" | "pan" | "fill" | "shape";

function resizeGrid(
  oldGrid: string[][],
  newWidth: number,
  newHeight: number
): string[][] {
  const oldHeight = oldGrid.length;
  const oldWidth = oldGrid[0]?.length ?? 0;
  const newGrid = [];
  for (let r = 0; r < newHeight; r++) {
    const row: string[] = [];
    for (let c = 0; c < newWidth; c++) {
      if (r < oldHeight && c < oldWidth) {
        row.push(oldGrid[r][c]);
      } else {
        row.push("transparent");
      }
    }
    newGrid.push(row);
  }
  return newGrid;
}

export default function Paint() {
  const [gridWidth, setGridWidth] = useState<number>(DEFAULT_GRID_WIDTH);
  const [gridHeight, setGridHeight] = useState<number>(DEFAULT_GRID_HEIGHT);
  const [grid, setGrid] = useState<string[][]>(createGrid(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT));
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [zoom, setZoom] = useState<number>(1);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [showColorPalette, setShowColorPalette] = useState<boolean>(false);

  const [showCustomColorPicker, setShowCustomColorPicker] = useState<boolean>(false);
  const [customColor, setCustomColor] = useState<string>("#888888");

  const [paletteColors, setPaletteColors] = useState<string[]>([...INITIAL_TAILWIND_COLORS]);

  const [tool, setTool] = useState<Tool>("pen");

  const [brushSize, setBrushSize] = useState<number>(DEFAULT_SIZE);

  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");
  const [shapeDrag, setShapeDrag] = useState<{
    start: { row: number; col: number } | null;
    end: { row: number; col: number } | null;
    preview: boolean;
  }>({ start: null, end: null, preview: false });

  const [showSizeMenu, setShowSizeMenu] = useState<boolean>(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const mouseStart = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const panButtonRef = useRef<HTMLButtonElement>(null);
  const eraserButtonRef = useRef<HTMLButtonElement>(null);
  const penButtonRef = useRef<HTMLButtonElement>(null);
  const fillButtonRef = useRef<HTMLButtonElement>(null);

  const [exportRes, setExportRes] = useState<number>(EXPORT_DEFAULT);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  const [showResizeMenu, setShowResizeMenu] = useState<boolean>(false);
  const resizeMenuRef = useRef<HTMLDivElement>(null);
  const resizeButtonRef = useRef<HTMLButtonElement>(null);

  const [showGridLines, setShowGridLines] = useState<boolean>(true);

  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);

  const undoStack = useRef<string[][][]>([]);
  const redoStack = useRef<string[][][]>([]);
  const [, forceUpdate] = useState(0);

  const dragStartGrid = useRef<string[][] | null>(null);
  const isDragPainting = useRef<boolean>(false);

  // --- Add state for clear canvas confirmation ---
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // ---

  const pushUndo = useCallback((newGrid: string[][]) => {
    undoStack.current.push(grid.map((row) => [...row]));
    redoStack.current = [];
    setGrid(newGrid);
    forceUpdate((v) => v + 1);
  }, [grid]);

  const pushGroupedUndo = useCallback((startGrid: string[][], endGrid: string[][]) => {
    undoStack.current.push(startGrid.map((row) => [...row]));
    redoStack.current = [];
    setGrid(endGrid);
    forceUpdate((v) => v + 1);
  }, []);

  const [resizeWidth, setResizeWidth] = useState<number>(gridWidth);
  const [resizeHeight, setResizeHeight] = useState<number>(gridHeight);

  const handleResizeWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = clamp(Number(e.target.value), MIN_GRID_SIZE, MAX_GRID_SIZE);
    setResizeWidth(newWidth);
    setGridWidth(newWidth);
    setGrid((prevGrid) => resizeGrid(prevGrid, newWidth, gridHeight));
    undoStack.current = [];
    redoStack.current = [];
    forceUpdate((v) => v + 1);
  };
  const handleResizeHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = clamp(Number(e.target.value), MIN_GRID_SIZE, MAX_GRID_SIZE);
    setResizeHeight(newHeight);
    setGridHeight(newHeight);
    setGrid((prevGrid) => resizeGrid(prevGrid, gridWidth, newHeight));
    undoStack.current = [];
    redoStack.current = [];
    forceUpdate((v) => v + 1);
  };

  const paintCell = (row: number, col: number, { group = false } = {}) => {
    let colorToApply = selectedColor;
    if (tool === "eraser") colorToApply = "transparent";
    const half = Math.floor(brushSize / 2);
    let changed = false;
    const newGrid = grid.map((r) => [...r]);
    for (let dr = -half; dr < brushSize - half; dr++) {
      for (let dc = -half; dc < brushSize - half; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < gridHeight && c >= 0 && c < gridWidth) {
          if (newGrid[r][c] !== colorToApply) {
            newGrid[r][c] = colorToApply;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      if (group) {
        setGrid(newGrid);
      } else {
        pushUndo(newGrid);
      }
    }
  };

  function getShapeCells(
    start: { row: number; col: number },
    end: { row: number; col: number },
    type: ShapeType
  ): { row: number; col: number }[] {
    let r1 = clamp(start.row, 0, gridHeight - 1);
    let c1 = clamp(start.col, 0, gridWidth - 1);
    let r2 = clamp(end.row, 0, gridHeight - 1);
    let c2 = clamp(end.col, 0, gridWidth - 1);
    if (r1 > r2) [r1, r2] = [r2, r1];
    if (c1 > c2) [c1, c2] = [c2, c1];
    if (type === "square" || type === "circle" || type === "rhombus") {
      const size = Math.max(r2 - r1, c2 - c1);
      r2 = r1 + size;
      c2 = c1 + size;
      if (r2 >= gridHeight) {
        r2 = gridHeight - 1;
        r1 = Math.max(0, r2 - size);
      }
      if (c2 >= gridWidth) {
        c2 = gridWidth - 1;
        c1 = Math.max(0, c2 - size);
      }
    }
    const cells: { row: number; col: number }[] = [];
    if (type === "rectangle" || type === "square") {
      for (let c = c1; c <= c2; c++) {
        cells.push({ row: r1, col: c });
        if (r2 !== r1) cells.push({ row: r2, col: c });
      }
      for (let r = r1 + 1; r < r2; r++) {
        cells.push({ row: r, col: c1 });
        if (c2 !== c1) cells.push({ row: r, col: c2 });
      }
    } else if (type === "circle") {
      const centerRow = Math.round((r1 + r2) / 2);
      const centerCol = Math.round((c1 + c2) / 2);
      const radius = Math.abs(r2 - r1) / 2;
      const steps = Math.max(12, Math.round(2 * Math.PI * radius));
      for (let t = 0; t < steps; t++) {
        const theta = (2 * Math.PI * t) / steps;
        const rr = Math.round(centerRow + radius * Math.sin(theta));
        const cc = Math.round(centerCol + radius * Math.cos(theta));
        if (
          rr >= 0 &&
          rr < gridHeight &&
          cc >= 0 &&
          cc < gridWidth &&
          !cells.some((cell) => cell.row === rr && cell.col === cc)
        ) {
          cells.push({ row: rr, col: cc });
        }
      }
    } else if (type === "rhombus") {
      const midRow = Math.floor((r1 + r2) / 2);
      const midCol = Math.floor((c1 + c2) / 2);
      const top = { row: r1, col: midCol };
      const right = { row: midRow, col: c2 };
      const bottom = { row: r2, col: midCol };
      const left = { row: midRow, col: c1 };
      function line(p1: { row: number; col: number }, p2: { row: number; col: number }) {
        const points: { row: number; col: number }[] = [];
        let x0 = p1.col;
        let y0 = p1.row;
        const x1 = p2.col;
        const y1 = p2.row;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
          points.push({ row: y0, col: x0 });
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
        }
        return points;
      }
      const edge1 = line(top, right);
      const edge2 = line(right, bottom);
      const edge3 = line(bottom, left);
      const edge4 = line(left, top);
      const allPoints = [...edge1, ...edge2, ...edge3, ...edge4];
      const uniqueCells: { row: number; col: number }[] = [];
      for (const cell of allPoints) {
        if (
          cell.row >= 0 && cell.row < gridHeight &&
          cell.col >= 0 && cell.col < gridWidth &&
          !uniqueCells.some((c) => c.row === cell.row && c.col === cell.col)
        ) {
          uniqueCells.push(cell);
        }
      }
      return uniqueCells;
    }
    return cells;
  }

  const handleShapeCellMouseDown = (row: number, col: number) => {
    if (tool !== "shape") return;
    setShapeDrag({ start: { row, col }, end: { row, col }, preview: true });
    dragStartGrid.current = grid.map((row) => [...row]);
    setIsPainting(true);
  };

  const handleShapeCellMouseEnter = (row: number, col: number) => {
    if (tool !== "shape") return;
    if (isPainting && shapeDrag.start) {
      setShapeDrag((prev) => ({
        ...prev,
        end: { row, col },
        preview: true,
      }));
    }
    setHoverCell({ row, col });
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleShapeCellMouseUp = (row: number, col: number) => {
    if (tool !== "shape") return;
    if (isPainting && shapeDrag.start && shapeDrag.end) {
      const cells = getShapeCells(shapeDrag.start, shapeDrag.end, shapeType);
      const newGrid = grid.map((r) => [...r]);
      for (const cell of cells) {
        if (
          cell.row >= 0 &&
          cell.row < gridHeight &&
          cell.col >= 0 &&
          cell.col < gridWidth
        ) {
          newGrid[cell.row][cell.col] = selectedColor;
        }
      }
      pushUndo(newGrid);
    }
    setIsPainting(false);
    setShapeDrag({ start: null, end: null, preview: false });
    dragStartGrid.current = null;
  };

  function floodFill(startRow: number, startCol: number, fillColor: string) {
    const prev = grid;
    const targetColor = prev[startRow][startCol];
    if (targetColor === fillColor) return;
    const newGrid = prev.map((row) => [...row]);
    const stack: [number, number][] = [[startRow, startCol]];
    const visited = Array.from({ length: gridHeight }, () =>
      Array(gridWidth).fill(false)
    );
    while (stack.length > 0) {
      const [row, col] = stack.pop()!;
      if (
        row < 0 ||
        row >= gridHeight ||
        col < 0 ||
        col >= gridWidth ||
        visited[row][col] ||
        newGrid[row][col] !== targetColor
      ) {
        continue;
      }
      newGrid[row][col] = fillColor;
      visited[row][col] = true;
      stack.push([row - 1, col]);
      stack.push([row + 1, col]);
      stack.push([row, col - 1]);
      stack.push([row, col + 1]);
    }
    pushUndo(newGrid);
  }

  const handleCellMouseDown = (row: number, col: number) => {
    if (tool === "pan" || isPanMode) return;
    if (tool === "fill") {
      floodFill(row, col, selectedColor);
      return;
    }
    if (tool === "shape") {
      handleShapeCellMouseDown(row, col);
      return;
    }
    setIsPainting(true);
    isDragPainting.current = true;
    dragStartGrid.current = grid.map((row) => [...row]);
    paintCell(row, col, { group: true });
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (tool === "pan" || isPanMode) return;
    if (tool === "fill") return;
    if (tool === "shape") {
      handleShapeCellMouseEnter(row, col);
      return;
    }
    if (isPainting && isDragPainting.current) {
      paintCell(row, col, { group: true });
    }
    setHoverCell({ row, col });
  };

  const handleCellMouseLeave = (row: number, col: number) => {
    setHoverCell((prev) => {
      if (prev && prev.row === row && prev.col === col) return null;
      return prev;
    });
  };

  const handleMouseUp = () => {
    if (tool === "shape") {
      if (isPainting && shapeDrag.start && shapeDrag.end) {
        handleShapeCellMouseUp(shapeDrag.end.row, shapeDrag.end.col);
      }
      setIsPainting(false);
      setShapeDrag({ start: null, end: null, preview: false });
      dragStartGrid.current = null;
      return;
    }
    if (isPainting && isDragPainting.current && dragStartGrid.current) {
      let changed = false;
      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          if (dragStartGrid.current[r][c] !== grid[r][c]) {
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) {
        pushGroupedUndo(dragStartGrid.current, grid);
      }
    }
    setIsPainting(false);
    isDragPainting.current = false;
    dragStartGrid.current = null;
    setIsPanning(false);
    panStart.current = null;
    mouseStart.current = null;
  };

  const handleMouseLeave = () => {
    if (tool === "shape") {
      setIsPainting(false);
      setShapeDrag({ start: null, end: null, preview: false });
      dragStartGrid.current = null;
      setHoverCell(null);
      return;
    }
    if (isPainting && isDragPainting.current && dragStartGrid.current) {
      let changed = false;
      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          if (dragStartGrid.current[r][c] !== grid[r][c]) {
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) {
        pushGroupedUndo(dragStartGrid.current, grid);
      }
    }
    setIsPainting(false);
    isDragPainting.current = false;
    dragStartGrid.current = null;
    setIsPanning(false);
    panStart.current = null;
    mouseStart.current = null;
    setHoverCell(null);
  };

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prevGrid = undoStack.current.pop();
    if (!prevGrid) return;
    redoStack.current.unshift(grid.map((row) => [...row]));
    setGrid(prevGrid.map((row) => [...row]));
    forceUpdate((v) => v + 1);
  }, [grid]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const nextGrid = redoStack.current.shift();
    if (!nextGrid) return;
    undoStack.current.push(grid.map((row) => [...row]));
    setGrid(nextGrid.map((row) => [...row]));
    forceUpdate((v) => v + 1);
  }, [grid]);

  // --- Add clear canvas handler ---
  const handleClearCanvas = useCallback(() => {
    // Push current grid to undo stack for undo support
    undoStack.current.push(grid.map((row) => [...row]));
    redoStack.current = [];
    setGrid(createGrid(gridWidth, gridHeight));
    forceUpdate((v) => v + 1);
    setShowClearConfirm(false); // Hide confirmation after clearing
  }, [grid, gridWidth, gridHeight]);
  // ---

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
    } else if (e.deltaY > 0) {
      newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    }
    setZoom(Number(newZoom.toFixed(2)));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))));

  const CANVAS_SIZE = 512;
  let canvasWidth = CANVAS_SIZE;
  let canvasHeight = CANVAS_SIZE;
  if (gridWidth > gridHeight) {
    canvasWidth = CANVAS_SIZE;
    canvasHeight = Math.round(CANVAS_SIZE * (gridHeight / gridWidth));
  } else if (gridHeight > gridWidth) {
    canvasHeight = CANVAS_SIZE;
    canvasWidth = Math.round(CANVAS_SIZE * (gridWidth / gridHeight));
  }

  const PAN_BORDER = 32;

  function getPanBounds(zoom: number) {
    const scaledWidth = canvasWidth * zoom;
    const scaledHeight = canvasHeight * zoom;
    let maxX = 0, minX = 0, maxY = 0, minY = 0;
    if (scaledWidth >= canvasWidth) {
      const halfDiffX = (scaledWidth - canvasWidth) / 2;
      maxX = halfDiffX + PAN_BORDER;
      minX = -halfDiffX - PAN_BORDER;
    } else {
      const halfDiffX = (canvasWidth - scaledWidth) / 2;
      maxX = halfDiffX - PAN_BORDER;
      minX = -halfDiffX + PAN_BORDER;
    }
    if (scaledHeight >= canvasHeight) {
      const halfDiffY = (scaledHeight - canvasHeight) / 2;
      maxY = halfDiffY + PAN_BORDER;
      minY = -halfDiffY - PAN_BORDER;
    } else {
      const halfDiffY = (canvasHeight - scaledHeight) / 2;
      maxY = halfDiffY - PAN_BORDER;
      minY = -halfDiffY + PAN_BORDER;
    }
    return { minX, maxX, minY, maxY };
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(tool === "pan" || isPanMode)) return;
    setIsPanning(true);
    panStart.current = { ...pan };
    mouseStart.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(tool === "pan" || isPanMode) || !isPanning || !panStart.current || !mouseStart.current) return;
    const dx = e.clientX - mouseStart.current.x;
    const dy = e.clientY - mouseStart.current.y;
    let newX = panStart.current.x + dx;
    let newY = panStart.current.y + dy;
    const { minX, maxX, minY, maxY } = getPanBounds(zoom);
    newX = clamp(newX, minX, maxX);
    newY = clamp(newY, minY, maxY);
    setPan({
      x: newX,
      y: newY,
    });
  };

  useEffect(() => {
    const { minX, maxX, minY, maxY } = getPanBounds(zoom);
    setPan((prev) => ({
      x: clamp(prev.x, minX, maxX),
      y: clamp(prev.y, minY, maxY),
    }));
  }, [zoom, gridWidth, gridHeight, canvasWidth, canvasHeight]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (tool === "shape") {
        if (isPainting && shapeDrag.start && shapeDrag.end) {
          handleShapeCellMouseUp(shapeDrag.end.row, shapeDrag.end.col);
        }
        setIsPainting(false);
        setShapeDrag({ start: null, end: null, preview: false });
        dragStartGrid.current = null;
        return;
      }
      if (isPainting && isDragPainting.current && dragStartGrid.current) {
        let changed = false;
        for (let r = 0; r < gridHeight; r++) {
          for (let c = 0; c < gridWidth; c++) {
            if (dragStartGrid.current[r][c] !== grid[r][c]) {
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
        if (changed) {
          pushGroupedUndo(dragStartGrid.current, grid);
        }
      }
      setIsPainting(false);
      isDragPainting.current = false;
      dragStartGrid.current = null;
      setIsPanning(false);
      panStart.current = null;
      mouseStart.current = null;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [grid, gridWidth, gridHeight, pushGroupedUndo, tool, shapeDrag]);

  useEffect(() => {
    if (!showColorPalette) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target as Node) &&
        colorButtonRef.current &&
        !colorButtonRef.current.contains(e.target as Node)
      ) {
        setShowColorPalette(false);
        setShowCustomColorPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColorPalette]);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node) &&
        exportButtonRef.current &&
        !exportButtonRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showResizeMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        resizeMenuRef.current &&
        !resizeMenuRef.current.contains(e.target as Node) &&
        resizeButtonRef.current &&
        !resizeButtonRef.current.contains(e.target as Node)
      ) {
        setShowResizeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showResizeMenu]);

  useEffect(() => {
    if (!showSizeMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(e.target as Node) &&
        sizeButtonRef.current &&
        !sizeButtonRef.current.contains(e.target as Node)
      ) {
        setShowSizeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSizeMenu]);

  useEffect(() => {
    if (!showShapeMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        shapeMenuRef.current &&
        !shapeMenuRef.current.contains(e.target as Node) &&
        shapeButtonRef.current &&
        !shapeButtonRef.current.contains(e.target as Node)
      ) {
        setShowShapeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShapeMenu]);

  // --- Dismiss clear confirm popup on outside click ---
  useEffect(() => {
    if (!showClearConfirm) return;
    function handleClickOutside(e: MouseEvent) {
      // Only close if click is outside the popup
      const popup = document.getElementById("clear-canvas-confirm-popup");
      if (popup && !popup.contains(e.target as Node)) {
        setShowClearConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showClearConfirm]);
  // ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPanMode(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyY" || (e.shiftKey && e.code === "KeyZ"))) {
        e.preventDefault();
        handleRedo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPanMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [grid, handleUndo, handleRedo]);

  function getCellBorderClasses(rowIdx: number, colIdx: number) {
    if (!showGridLines) return "";
    let classes = "";
    if (colIdx < gridWidth - 1) classes += " border-r border-gray-300";
    if (rowIdx < gridHeight - 1) classes += " border-b border-gray-300";
    return classes;
  }

  function getColorButtonBorderClass(color: string) {
    return selectedColor === color
      ? "border-2 border-gray-400"
      : "border border-gray-400";
  }

  function isCellHovered(row: number, col: number) {
    if (tool === "shape") return false;
    if (!hoverCell) return false;
    const half = Math.floor(brushSize / 2);
    const startRow = hoverCell.row - half;
    const endRow = hoverCell.row + (brushSize - half) - 1;
    const startCol = hoverCell.col - half;
    const endCol = hoverCell.col + (brushSize - half) - 1;
    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }

  function getCellHoverStyle(row: number, col: number, color: string) {
    if (
      tool === "shape" &&
      shapeDrag.preview &&
      shapeDrag.start &&
      shapeDrag.end
    ) {
      const shapeCells = getShapeCells(shapeDrag.start, shapeDrag.end, shapeType);
      if (shapeCells.some((cell) => cell.row === row && cell.col === col)) {
        return {
          backgroundColor: tailwindClassToHex(selectedColor),
          opacity: 0.7,
          filter: "brightness(1.08)",
          transition: "background-color 0.12s, opacity 0.12s, filter 0.12s",
        };
      }
    }
    if (!isCellHovered(row, col)) return {};
    if (tool === "eraser") {
      return {
        opacity: 0.3,
        transition: "opacity 0.12s",
      };
    }
    const baseColor = tailwindClassToHex(selectedColor);
    const style: React.CSSProperties = {
      backgroundColor: baseColor,
      opacity: 0.6,
      transition: "background-color 0.12s, opacity 0.12s, filter 0.12s",
      filter: "brightness(1.08)",
    };
    if (color === "transparent") {
      style.backgroundColor = baseColor;
      style.opacity = .9;
      style.filter = "brightness(1.08)";
    }
    else {
      style.backgroundColor = baseColor;
      style.opacity = .9;
      style.filter = "brightness(1.08)";
    }
    return style;
  }

  function handleExportPNG() {
    setIsExporting(true);
    let outWidth = exportRes;
    let outHeight = exportRes;
    if (gridWidth > gridHeight) {
      outWidth = exportRes;
      outHeight = Math.round(exportRes * (gridHeight / gridWidth));
    } else if (gridHeight > gridWidth) {
      outHeight = exportRes;
      outWidth = Math.round(exportRes * (gridWidth / gridHeight));
    }
    const cellEdgesX: number[] = [];
    const cellEdgesY: number[] = [];
    for (let c = 0; c <= gridWidth; c++) {
      cellEdgesX.push(Math.round((c * outWidth) / gridWidth));
    }
    for (let r = 0; r <= gridHeight; r++) {
      cellEdgesY.push(Math.round((r * outHeight) / gridHeight));
    }
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsExporting(false);
      return;
    }
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const color = grid[row][col];
        const x = cellEdgesX[col];
        const y = cellEdgesY[row];
        const w = cellEdgesX[col + 1] - cellEdgesX[col];
        const h = cellEdgesY[row + 1] - cellEdgesY[row];
        if (color === "transparent") {
          continue;
        } else {
          ctx.fillStyle = tailwindClassToHex(color);
          ctx.fillRect(x, y, w, h);
        }
      }
    }
    canvas.toBlob((blob) => {
      setIsExporting(false);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixel-art-${gridWidth}x${gridHeight}-${outWidth}x${outHeight}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }, "image/png");
  }

  const exportMarks: number[] = [];
  for (let i = EXPORT_MIN; i <= EXPORT_MAX; i += EXPORT_STEP) {
    exportMarks.push(i);
  }

  const undoStackLength = undoStack.current.length;
  const redoStackLength = redoStack.current.length;

  let exportDisplayWidth = exportRes;
  let exportDisplayHeight = exportRes;
  if (gridWidth > gridHeight) {
    exportDisplayWidth = exportRes;
    exportDisplayHeight = Math.round(exportRes * (gridHeight / gridWidth));
  } else if (gridHeight > gridWidth) {
    exportDisplayHeight = exportRes;
    exportDisplayWidth = Math.round(exportRes * (gridWidth / gridHeight));
  }

  const handleAddCustomColor = () => {
    if (!paletteColors.includes(customColor)) {
      setPaletteColors((prev) => [...prev, customColor]);
    }
    setSelectedColor(customColor);
    setShowColorPalette(false);
    setShowCustomColorPicker(false);
  };

  const handleShowCustomColorPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCustomColorPicker((v) => !v);
  };

  function getBottomMenuColorPreviewStyle() {
    if (selectedColor.startsWith("bg-")) {
      return undefined;
    }
    if (selectedColor.startsWith("#")) {
      return {
        background: selectedColor,
        width: 40,
        height: 40,
        marginRight: 8,
        cursor: "pointer",
        outline: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.13)",
      };
    }
    return undefined;
  }

  function getTopMenuButtonClass({ selected }: { selected: boolean }) {
    return `border rounded px-3 py-1 font-mono flex items-center gap-1 transition ${
      selected
        ? "bg-blue-200 border-blue-400"
        : "bg-white border-gray-300 hover:bg-blue-100 active:bg-blue-200"
    }`;
  }
  function getTopMenuButtonStyle({ selected }: { selected: boolean }) {
    return {
      minWidth: 40,
      height: 40,
      borderRadius: "0.5rem",
      fontWeight: "bold",
      outline: "none",
      boxShadow: selected
        ? "0 1px 4px rgba(59,130,246,0.2)"
        : "0 1px 4px rgba(0,0,0,0.13)",
      cursor: "pointer",
    };
  }

  function getZoomDisplay() {
    return (
      <span
        className="font-mono w-16 flex items-center justify-center text-base px-3 py-1 rounded bg-gray-100 border border-gray-300 shadow-sm"
        style={{
          minWidth: 56,
          textAlign: "center",
          fontWeight: 600,
          height: 40,
          letterSpacing: "0.01em",
          color: "#222",
          background: "#f3f4f6",
          borderRadius: "0.5rem",
          border: "1px solid #d1d5db",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
        aria-label="Current zoom"
      >
        {Math.round(zoom * 100)}%
      </span>
    );
  }

  function renderCanvasCells() {
    const shapePreviewCells: Set<string> = new Set();
    if (
      tool === "shape" &&
      shapeDrag.preview &&
      shapeDrag.start &&
      shapeDrag.end
    ) {
      for (const cell of getShapeCells(shapeDrag.start, shapeDrag.end, shapeType)) {
        shapePreviewCells.add(`${cell.row},${cell.col}`);
      }
    }

    if (showGridLines) {
      return grid.map((row, rowIdx) =>
        row.map((color, colIdx) => {
          const isTransparent = color === "transparent";
          const isCustom = color.startsWith("#");
          const isShapePreview =
            tool === "shape" &&
            shapeDrag.preview &&
            shapePreviewCells.has(`${rowIdx},${colIdx}`);
          return (
            <div
              key={`${rowIdx}-${colIdx}`}
              onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
              onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
              onMouseLeave={() => handleCellMouseLeave(rowIdx, colIdx)}
              onMouseUp={
                tool === "shape"
                  ? () => handleShapeCellMouseUp(rowIdx, colIdx)
                  : undefined
              }
              className={`transition-colors duration-100 box-border ${getCellBorderClasses(rowIdx, colIdx)} ${isTransparent
                ? "bg-[repeating-conic-gradient(theme(colors.gray.200)_0%_25%,white_0%_50%)_50%_/_16px_16px]"
                : (!isCustom ? color : "")
              }`}
              style={{
                width: "100%",
                height: "100%",
                aspectRatio: "1 / 1",
                pointerEvents: (tool === "pan" || isPanMode) ? "none" : "auto",
                ...(color.startsWith("#") ? { backgroundColor: color } : {}),
                ...(isShapePreview
                  ? {
                      backgroundColor: tailwindClassToHex(selectedColor),
                      opacity: 0.7,
                      filter: "brightness(1.08)",
                      transition: "background-color 0.12s, opacity 0.12s, filter 0.12s",
                    }
                  : getCellHoverStyle(rowIdx, colIdx, color)),
              }}
              draggable={false}
            />
          );
        })
      );
    } else {
      return grid.map((row, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: `${100 / gridHeight}%`,
          }}
        >
          {row.map((color, colIdx) => {
            const isTransparent = color === "transparent";
            const isCustom = color.startsWith("#");
            const isShapePreview =
              tool === "shape" &&
              shapeDrag.preview &&
              shapePreviewCells.has(`${rowIdx},${colIdx}`);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
                onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                onMouseLeave={() => handleCellMouseLeave(rowIdx, colIdx)}
                onMouseUp={
                  tool === "shape"
                    ? () => handleShapeCellMouseUp(rowIdx, colIdx)
                    : undefined
                }
                className={`transition-colors duration-100 ${isTransparent
                  ? "bg-[repeating-conic-gradient(theme(colors.gray.200)_0%_25%,white_0%_50%)_50%_/_16px_16px]"
                  : (!isCustom ? color : "")
                }`}
                style={{
                  width: `${100 / gridWidth}%`,
                  height: "100%",
                  aspectRatio: "1 / 1",
                  pointerEvents: (tool === "pan" || isPanMode) ? "none" : "auto",
                  ...(color.startsWith("#") ? { backgroundColor: color } : {}),
                  ...(isShapePreview
                    ? {
                        backgroundColor: tailwindClassToHex(selectedColor),
                        opacity: 0.7,
                        filter: "brightness(1.08)",
                        transition: "background-color 0.12s, opacity 0.12s, filter 0.12s",
                      }
                    : getCellHoverStyle(rowIdx, colIdx, color)),
                  display: "block",
                  margin: 0,
                  padding: 0,
                  boxSizing: "border-box",
                }}
                draggable={false}
              />
            );
          })}
        </div>
      ));
    }
  }

  function getBrushSizeIcon(size: number) {
    if (size === 1) return <SquareIcon size={26} />;
    if (size === 2) return <Grid2X2Icon size={26} />;
    if (size === 3) return <Grid3X3Icon size={26} />;
    return <SquareIcon size={26} />;
  }

  function getToolButtonClass(toolName: Tool, selected: boolean) {
    let selectedBg = "";
    let selectedBorder = "";
    let hoverBg = "";
    let hoverBorder = "";
    switch (toolName) {
      case "pen":
        selectedBg = "bg-green-300";
        selectedBorder = "border-green-400";
        hoverBg = "bg-green-100";
        hoverBorder = "border-green-300";
        break;
      case "eraser":
        selectedBg = "bg-yellow-200";
        selectedBorder = "border-yellow-400";
        hoverBg = "bg-yellow-100";
        hoverBorder = "border-yellow-300";
        break;
      case "fill":
        selectedBg = "bg-cyan-200";
        selectedBorder = "border-cyan-400";
        hoverBg = "bg-cyan-100";
        hoverBorder = "border-cyan-300";
        break;
      case "shape":
        selectedBg = "bg-purple-200";
        selectedBorder = "border-purple-400";
        hoverBg = "bg-purple-100";
        hoverBorder = "border-purple-300";
        break;
      case "pan":
        selectedBg = "bg-blue-200";
        selectedBorder = "border-blue-400";
        hoverBg = "bg-blue-100";
        hoverBorder = "border-blue-300";
        break;
      default:
        selectedBg = "bg-white";
        selectedBorder = "border-gray-200";
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        hoverBg = "bg-blue-100";
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        hoverBorder = "border-blue-300";
    }
    return `border rounded px-3 py-1 font-mono flex items-center gap-2 transition group ${selected ? `${selectedBg} ${selectedBorder}` : `bg-white border-gray-200`}`;
  }
  function getToolButtonStyle(toolName: Tool, selected: boolean, hovered: boolean) {
    let selectedShadow = "";
    let hoverBg = "";
    let selectedBg = "";
    let selectedBorder = "";
    switch (toolName) {
      case "pen":
        selectedShadow = "0 1px 4px rgba(134,239,172,0.4)";
        hoverBg = "#bbf7d0";
        selectedBg = "#86efac";
        selectedBorder = "#4ade80";
        break;
      case "eraser":
        selectedShadow = "0 1px 4px rgba(253,224,71,0.4)";
        hoverBg = "#fef9c3";
        selectedBg = "#fef08a";
        selectedBorder = "#facc15";
        break;
      case "fill":
        selectedShadow = "0 1px 4px rgba(6,182,212,0.2)";
        hoverBg = "#cffafe";
        selectedBg = "#a5f3fc";
        selectedBorder = "#06b6d4";
        break;
      case "shape":
        selectedShadow = "0 1px 4px rgba(192,132,252,0.2)";
        hoverBg = "#f3e8ff";
        selectedBg = "#ddd6fe";
        selectedBorder = "#a78bfa";
        break;
      case "pan":
        selectedShadow = "0 1px 4px rgba(59,130,246,0.2)";
        hoverBg = "#dbeafe";
        selectedBg = "#bfdbfe";
        selectedBorder = "#60a5fa";
        break;
      default:
        selectedShadow = "0 1px 4px rgba(0,0,0,0.13)";
        hoverBg = "#dbeafe";
        selectedBg = "#fff";
        selectedBorder = "#e5e7eb";
    }
    const style: React.CSSProperties = {
      minWidth: 40,
      height: 40,
      borderRadius: "0.5rem",
      fontWeight: selected ? "bold" : "bold",
      outline: "none",
      boxShadow: selected ? selectedShadow : "0 1px 4px rgba(0,0,0,0.13)",
      cursor: "pointer",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: selected ? selectedBorder : "#e5e7eb",
      background: selected ? selectedBg : "#fff",
      transition: "background 0.13s, border-color 0.13s, box-shadow 0.13s",
    };
    if (!selected && hovered) {
      style.background = hoverBg;
    }
    return style;
  }

  const [toolButtonHover, setToolButtonHover] = useState<{ [key in Tool]?: boolean }>({});

  function handleToolButtonMouseEnter(toolName: Tool) {
    setToolButtonHover((prev) => ({ ...prev, [toolName]: true }));
  }
  function handleToolButtonMouseLeave(toolName: Tool) {
    setToolButtonHover((prev) => ({ ...prev, [toolName]: false }));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shapeButtonHover, setShapeButtonHover] = useState<{ [key in ShapeType]?: boolean }>({});

  function handleShapeButtonMouseEnter(shape: ShapeType) {
    setShapeButtonHover((prev) => ({ ...prev, [shape]: true }));
  }
  function handleShapeButtonMouseLeave(shape: ShapeType) {
    setShapeButtonHover((prev) => ({ ...prev, [shape]: false }));
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-screen">
      <div className="fixed left-1/2 top-2 rounded -translate-x-1/2 h-16 bg-white/60 border-white/80 border-2 flex items-center justify-center gap-4 px-4 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStackLength === 0}
            className={`border rounded px-2 py-1 font-mono flex items-center justify-center transition bg-white border-gray-300 hover:bg-blue-100 active:bg-blue-200 ${undoStackLength === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-label="Undo"
            style={{
              minWidth: 32,
              height: 40,
              borderRadius: "0.5rem",
              outline: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.13)",
              cursor: undoStackLength === 0 ? "not-allowed" : "pointer",
            }}
            title="Undo (Ctrl+Z)"
            tabIndex={0}
          >
            <Undo2Icon size={20} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStackLength === 0}
            className={`border rounded px-2 py-1 font-mono flex items-center justify-center transition bg-white border-gray-300 hover:bg-blue-100 active:bg-blue-200 ${redoStackLength === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-label="Redo"
            style={{
              minWidth: 32,
              height: 40,
              borderRadius: "0.5rem",
              outline: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.13)",
              cursor: redoStackLength === 0 ? "not-allowed" : "pointer",
            }}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            tabIndex={0}
          >
            <Redo2Icon size={20} />
          </button>
          {/* --- Clear Canvas Button --- */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="border rounded px-2 py-1 font-mono flex items-center justify-center transition bg-white border-gray-300 hover:bg-red-100 active:bg-red-200"
            aria-label="Clear canvas"
            style={{
              minWidth: 32,
              height: 40,
              borderRadius: "0.5rem",
              outline: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.13)",
              cursor: "pointer",
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: 15,
              paddingLeft: 10,
              paddingRight: 10,
            }}
            title="Clear canvas (sets all cells to transparent)"
            tabIndex={0}
          >
            <Trash2Icon size={20} />
            <span className="hidden sm:inline" style={{ marginLeft: 6, fontWeight: 600, fontSize: 15 }}>
              Delete
            </span>
          </button>
          {/* --- End Clear Canvas Button --- */}
        </div>
        <div className="flex items-center gap-2">
          <button
            ref={resizeButtonRef}
            onClick={() => {
              setShowResizeMenu((v) => !v);
              setResizeWidth(gridWidth);
              setResizeHeight(gridHeight);
            }}
            className={getTopMenuButtonClass({ selected: showResizeMenu })}
            aria-label="Show resize menu"
            style={getTopMenuButtonStyle({ selected: showResizeMenu })}
            title="Resize grid"
          >
            <span role="img" aria-label="Resize" style={{ fontSize: 20 }}>
              <ImageUpscaleIcon/>
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              Resize
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGridLines((v) => !v)}
            className={getTopMenuButtonClass({ selected: showGridLines })}
            aria-label={showGridLines ? "Hide grid lines" : "Show grid lines"}
            style={getTopMenuButtonStyle({ selected: showGridLines })}
            title={showGridLines ? "Hide grid lines" : "Show grid lines"}
            tabIndex={0}
          >
            <span role="img" aria-label="Grid lines" style={{ fontSize: 20 }}>
              <Grid2X2Icon />
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              Grid
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2 mx-4">
          <button
            onClick={handleZoomOut}
            className="rounded border border-gray-300 bg-white hover:bg-blue-100 active:bg-blue-200 transition"
            aria-label="Zoom out"
            style={{
              minWidth: 32,
              height: 40,
              fontSize: 22,
              fontWeight: 700,
              borderRadius: "0.5rem",
              outline: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              cursor: "pointer",
            }}
          >
            -
          </button>
          {getZoomDisplay()}
          <button
            onClick={handleZoomIn}
            className="rounded border border-gray-300 bg-white hover:bg-blue-100 active:bg-blue-200 transition"
            aria-label="Zoom in"
            style={{
              minWidth: 32,
              height: 40,
              fontSize: 22,
              fontWeight: 700,
              borderRadius: "0.5rem",
              outline: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            ref={exportButtonRef}
            onClick={() => setShowExportMenu((v) => !v)}
            className={getTopMenuButtonClass({ selected: showExportMenu })}
            aria-label="Show export menu"
            style={getTopMenuButtonStyle({ selected: showExportMenu })}
            title="Export as PNG"
          >
            <span role="img" aria-label="Export" style={{ fontSize: 20 }}>
              <DownloadIcon/>
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              Export
            </span>
          </button>
        </div>
      </div>

      {/* --- Clear Canvas Confirmation Popup --- */}
      {showClearConfirm && (
        <div
          id="clear-canvas-confirm-popup"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          style={{ backdropFilter: "blur(1.5px)" }}
        >
          <div
            className="bg-white border-2 border-red-300 rounded-lg shadow-lg flex flex-col items-center px-8 py-6"
            style={{ minWidth: 320, maxWidth: "90vw" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Trash2Icon size={28} color="#b91c1c" />
              <span className="font-bold text-lg text-red-700">Delete All?</span>
            </div>
            <div className="mb-6 text-gray-700 text-center font-mono text-base">
              Are you sure you want to clear the canvas? <br />
              <span className="text-red-600 font-semibold">This cannot be undone.</span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleClearCanvas}
                className="px-5 py-2 rounded bg-red-600 text-white font-bold font-mono border border-red-700 shadow hover:bg-red-700 transition"
                style={{ fontSize: 16 }}
                autoFocus
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-5 py-2 rounded bg-gray-100 text-gray-800 font-mono border border-gray-300 shadow hover:bg-gray-200 transition"
                style={{ fontSize: 16 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- End Clear Canvas Confirmation Popup --- */}

      {showResizeMenu && (
        <div
          ref={resizeMenuRef}
          className="fixed left-1/2 top-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-4 items-center"
        >
          <div className="flex flex-col gap-4 items-center">
            <label className="font-mono text-sm flex items-center gap-2">
              <input
                type="number"
                min={MIN_GRID_SIZE}
                max={MAX_GRID_SIZE}
                value={resizeWidth}
                onChange={handleResizeWidthChange}
                className="border rounded px-2 py-1 w-16 text-center"
                style={{ fontFamily: "inherit" }}
                aria-label="Grid width"
              />
              <span className="font-mono text-base">x</span>
              <input
                type="number"
                min={MIN_GRID_SIZE}
                max={MAX_GRID_SIZE}
                value={resizeHeight}
                onChange={handleResizeHeightChange}
                className="border rounded px-2 py-1 w-16 text-center"
                style={{ fontFamily: "inherit" }}
                aria-label="Grid height"
              />
            </label>
          </div>
        </div>
      )}
      {showExportMenu && (
        <div
          ref={exportMenuRef}
          className="fixed left-1/2 top-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-4 items-center"
        >
          <div className="flex  gap-4 items-center">
            <label className="font-mono text-sm flex w-48 items-center gap-2">
              
              <input
                type="range"
                min={EXPORT_MIN}
                max={EXPORT_MAX}
                step={EXPORT_STEP}
                value={exportRes}
                onChange={e => setExportRes(Number(e.target.value))}
                style={{ width: 120, accentColor: "#3b82f6" }}
                aria-label="Export resolution"
              />
              
              <span className="font-mono text-xs">
                {exportDisplayWidth}x{exportDisplayHeight}
              </span>
            </label>
            <button
              onClick={handleExportPNG}
              disabled={isExporting}
              className={`border rounded px-4 py-2 font-mono flex items-center gap-2 transition bg-white border-gray-300 hover:bg-blue-100 active:bg-blue-200 ${isExporting ? "opacity-60 cursor-not-allowed" : ""}`}
              aria-label="Export as PNG"
              style={{
                minWidth: 80,
                height: 40,
                borderRadius: "0.5rem",
                fontWeight: "bold",
                outline: "none",
                boxShadow: "0 1px 4px rgba(0,0,0,0.13)",
                cursor: isExporting ? "not-allowed" : "pointer",
                fontSize: 16,
              }}
              title="Export as PNG"
            >
              <span role="img" aria-label="Export" style={{ fontSize: 20 }}>
                <DownloadIcon/>
              </span>
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      )}
      {showSizeMenu && (
        <div
          ref={sizeMenuRef}
          className="fixed left-1/2 bottom-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-4 items-center"
        >
          <div className="flex flex-row gap-4 items-center">
            {SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => {
                  setBrushSize(size);
                  setShowSizeMenu(false);
                }}
                className={`flex flex-col p-1 items-center justify-center border rounded  transition font-mono text-sm ${
                  brushSize === size
                    ? "bg-blue-200 border-blue-400 font-bold shadow"
                    : "bg-white border-gray-300 hover:bg-blue-100"
                }`}
            
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  outline: "none",
                  boxShadow:
                    brushSize === size
                      ? "0 1px 4px rgba(59,130,246,0.2)"
                      : "0 1px 4px rgba(0,0,0,0.10)",
                  cursor: "pointer",
                  fontWeight: brushSize === size ? "bold" : "normal",
                  fontSize: 16,
                }}
              >
                {getBrushSizeIcon(size)}
              </button>
            ))}
          </div>
        </div>
      )}
      {showShapeMenu && (
        <div
          ref={shapeMenuRef}
          className="fixed left-1/2 bottom-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-4 items-center"
        >
          <div className="flex flex-row gap-4 items-center">
            {SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.type}
                onClick={() => {
                  setShapeType(shape.type);
                  setShowShapeMenu(false);
                }}
                className={`flex flex-col p-1 items-center justify-center border rounded transition font-mono text-sm ${
                  shapeType === shape.type
                    ? "bg-purple-200 border-purple-400 font-bold shadow"
                    : "bg-white border-gray-300 hover:bg-purple-100"
                }`}
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  outline: "none",
                  boxShadow:
                    shapeType === shape.type
                      ? "0 1px 4px rgba(192,132,252,0.2)"
                      : "0 1px 4px rgba(0,0,0,0.10)",
                  cursor: "pointer",
                  fontWeight: shapeType === shape.type ? "bold" : "normal",
                  fontSize: 16,
                }}
                onMouseEnter={() => handleShapeButtonMouseEnter(shape.type)}
                onMouseLeave={() => handleShapeButtonMouseLeave(shape.type)}
                aria-label={shape.label}
                title={shape.label}
              >
                {shape.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center">
        <div
          ref={canvasRef}
          className={showGridLines ? "grid " : ""}
          style={{
            ...(showGridLines
              ? {
                  display: "grid",
                  gridTemplateRows: `repeat(${gridHeight}, 1fr)`,
                  gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
                }
              : {
                  display: "flex",
                  flexDirection: "column",
                }),
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            background: "transparent",
            border: "1px solid #ddd",
            overflow: "hidden",
            userSelect: "none",
            cursor:
              (tool === "pan" || isPanMode)
                ? (isPanning ? "grabbing" : "grab")
                : (tool === "fill" || tool === "shape"
                  ? "crosshair"
                  : "crosshair"),
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isPanning ? "none" : "transform 0.15s cubic-bezier(.4,2,.6,1)",
            transformOrigin: "center center",
          }}
          onWheel={handleWheel}
          tabIndex={0}
          aria-label="Paint canvas"
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseDown={(tool === "pan" || isPanMode) ? handleCanvasMouseDown : undefined}
          onMouseMove={(tool === "pan" || isPanMode) ? handleCanvasMouseMove : undefined}
        >
          {renderCanvasCells()}
        </div>
      </div>

      {showColorPalette && (
        <div
          ref={paletteRef}
          className="fixed left-1/2 bottom-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-2 items-center"
        >
          <div className="flex gap-2 items-center">
            {paletteColors.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setSelectedColor(color);
                  setShowColorPalette(false);
                }}
                className={
                  color.startsWith("bg-")
                    ? `${color} ${getColorButtonBorderClass(color)} w-8 h-8 rounded-full cursor-pointer outline-none`
                    : undefined
                }
                style={
                  color.startsWith("#")
                    ? {
                        background: color,
                        border: selectedColor === color ? "2px solid #888" : "1px solid #888",
                        width: 32,
                        height: 32,
                        borderRadius: "9999px",
                        cursor: "pointer",
                        outline: "none",
                        marginLeft: 2,
                        marginRight: 2,
                        boxShadow: selectedColor === color ? "0 1px 4px rgba(0,0,0,0.18)" : undefined,
                      }
                    : undefined
                }
                aria-label={
                  color.startsWith("bg-")
                    ? `Select color ${color.replace("bg-", "")}`
                    : `Select custom color ${color}`
                }
              />
            ))}
            <span className="mx-2 text-gray-400 select-none" style={{ fontWeight: 600, fontSize: 18 }}>|</span>
            <button
              type="button"
              aria-label="Add new color"
              className="px-3 py-1 rounded bg-blue-100 border cursor-pointer border-blue-300 text-xs font-mono font-semibold hover:bg-blue-200 transition"
              onClick={handleShowCustomColorPicker}
              tabIndex={0}
              style={{ height: 32, marginLeft: 2, marginRight: 2 }}
            >
              Add New Color
            </button>
          </div>
          {showCustomColorPicker && (
            <div className="flex justify-center gap-4 items-center mt-2">
              <input
                type="color"
                value={customColor}
                onChange={e => setCustomColor(e.target.value)}
                style={{ width: 256, height: 64, border: "none", background: "none", cursor: "pointer" }}
                aria-label="Pick custom color"
              />
              <button
                className="px-4 py-2 cursor-pointer rounded bg-green-100 border border-green-300 text-sm font-bold font-mono"
                onClick={handleAddCustomColor}
                style={{ marginTop: 4 }}
              >
                Add Color
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fixed left-1/2 bottom-2 rounded -translate-x-1/2 h-16 bg-white/60 border-white/80 border-2 flex items-center justify-center gap-4 px-4">
        <div className="flex gap-2 items-center">
          <button
            ref={colorButtonRef}
            onClick={() => {
              setShowColorPalette((v) => !v);
            }}
            className={
              selectedColor.startsWith("bg-")
                ? `${selectedColor} border-gray-200 mr-2 w-10 h-10 rounded-md cursor-pointer outline-none shadow ${tool === "eraser" ? "opacity-50" : ""}`
                : `border-gray-200 w-10 h-10 rounded-md cursor-pointer outline-none shadow ${(tool === "eraser" || tool === "pan") ? "opacity-50" : ""}`
            }
            aria-label="Show color palette"
            style={getBottomMenuColorPreviewStyle()}
          />
          <button
            ref={penButtonRef}
            onClick={() => setTool("pen")}
            className={getToolButtonClass("pen", tool === "pen")}
            aria-label="Pen tool"
            style={getToolButtonStyle("pen", tool === "pen", !!toolButtonHover["pen"])}
            title="Pen (draw with selected color)"
            onMouseEnter={() => handleToolButtonMouseEnter("pen")}
            onMouseLeave={() => handleToolButtonMouseLeave("pen")}
          >
            <span role="img" aria-label="Pen" style={{ fontSize: 20 }}>
              <PenIcon />  
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              PEN
            </span>
          </button>
          <button
            ref={eraserButtonRef}
            onClick={() => setTool("eraser")}
            className={getToolButtonClass("eraser", tool === "eraser")}
            aria-label="Eraser"
            style={getToolButtonStyle("eraser", tool === "eraser", !!toolButtonHover["eraser"])}
            title="Eraser (set cell to transparent)"
            onMouseEnter={() => handleToolButtonMouseEnter("eraser")}
            onMouseLeave={() => handleToolButtonMouseLeave("eraser")}
          >
            <span role="img" aria-label="Eraser" style={{ fontSize: 20 }}>
              <BrushCleaningIcon />
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              ERASE
            </span>
          </button>
          <button
            ref={fillButtonRef}
            onClick={() => setTool("fill")}
            className={getToolButtonClass("fill", tool === "fill")}
            aria-label="Fill tool"
            style={getToolButtonStyle("fill", tool === "fill", !!toolButtonHover["fill"])}
            title="Fill (bucket fill enclosed area with selected color)"
            onMouseEnter={() => handleToolButtonMouseEnter("fill")}
            onMouseLeave={() => handleToolButtonMouseLeave("fill")}
          >
            <span role="img" aria-label="Fill" style={{ fontSize: 20 }}>
              <PaintBucketIcon />
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              FILL
            </span>
          </button>
          <button
            ref={shapeButtonRef}
            onClick={() => {
              setTool("shape");
              setShowShapeMenu((v) => !v);
            }}
            className={getToolButtonClass("shape", tool === "shape")}
            aria-label="Shape tool"
            style={getToolButtonStyle("shape", tool === "shape", !!toolButtonHover["shape"])}
            title="Shape (draw hollow rectangle, square, circle, or rhombus)"
            onMouseEnter={() => handleToolButtonMouseEnter("shape")}
            onMouseLeave={() => handleToolButtonMouseLeave("shape")}
          >
            <span role="img" aria-label="Shape" style={{ fontSize: 20 }}>
              {SHAPE_OPTIONS.find((s) => s.type === shapeType)?.icon}
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              SHAPE
            </span>
          </button>
          <button
            ref={panButtonRef}
            onClick={() => setTool("pan")}
            className={getToolButtonClass("pan", tool === "pan")}
            aria-label="Toggle pan mode"
            style={getToolButtonStyle("pan", tool === "pan", !!toolButtonHover["pan"])}
            title="Pan (move canvas). Hold Space for temporary pan."
            onMouseEnter={() => handleToolButtonMouseEnter("pan")}
            onMouseLeave={() => handleToolButtonMouseLeave("pan")}
          >
            <span role="img" aria-label="Pan" style={{ fontSize: 20 }}>
              <HandIcon />
            </span>
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              PAN
            </span>
          </button>
          <button
            ref={sizeButtonRef}
            onClick={() => setShowSizeMenu((v) => !v)}
            className={`border rounded px-3 py-1 font-mono flex items-center gap-2 transition ${
              showSizeMenu ? "bg-blue-200 border-blue-400" : "bg-white border-gray-200 hover:bg-blue-100"
            }`}
            aria-label="Brush size"
            style={{
              minWidth: 40,
              height: 40,
              borderRadius: "0.5rem",
              fontWeight: "bold",
              outline: "none",
              boxShadow: showSizeMenu
                ? "0 1px 4px rgba(59,130,246,0.2)"
                : "0 1px 4px rgba(0,0,0,0.13)",
              cursor: "pointer",
            }}
            title="Brush size"
          >
            {getBrushSizeIcon(brushSize)}
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              SIZE  
            </span>
          </button>
        </div>
      </div>



      {/* --- END BOTTOM MENU --- */}


    </div>
  );
}
