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
} from "lucide-react";

const DEFAULT_GRID_WIDTH = 16;
const DEFAULT_GRID_HEIGHT = 16;
const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 64;

// Tailwind color class names for palette and grid
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

// PNG export settings
const EXPORT_MIN = 16;
const EXPORT_MAX = 1600;
const EXPORT_STEP = 16;
const EXPORT_DEFAULT = 512;

// Pen/Eraser size options
const SIZE_OPTIONS = [1, 2, 3];
const DEFAULT_SIZE = 1;

// Use "transparent" as the default background for all cells
function createGrid(width: number, height: number) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "transparent")
  );
}

// Helper to clamp a value between min and max
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// Helper: convert Tailwind color class or hex to hex
function tailwindClassToHex(cls: string): string {
  // If it's a hex color, just return it
  if (cls.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(cls)) {
    return cls;
  }
  // Map known classes to hex
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

// Helper: slightly lighten or darken a hex color
function adjustHexColor(hex: string, amount: number): string {
  // amount: positive to lighten, negative to darken, range -255 to 255
  let usePound = false;
  let color = hex;
  if (color[0] === "#") {
    color = color.slice(1);
    usePound = true;
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return (
    (usePound ? "#" : "") +
    ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1)
  );
}



type Tool = "pen" | "eraser" | "pan" | "fill";

// --- Helper: Resize grid and preserve pixels ---
// This function resizes a grid to newWidth/newHeight, preserving as much as possible
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
  // Separate width and height for grid
  const [gridWidth, setGridWidth] = useState<number>(DEFAULT_GRID_WIDTH);
  const [gridHeight, setGridHeight] = useState<number>(DEFAULT_GRID_HEIGHT);
  const [grid, setGrid] = useState<string[][]>(createGrid(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT));
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [zoom, setZoom] = useState<number>(1);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [showColorPalette, setShowColorPalette] = useState<boolean>(false);

  // Custom color palette state
  const [showCustomColorPicker, setShowCustomColorPicker] = useState<boolean>(false);
  const [customColor, setCustomColor] = useState<string>("#888888");

  // Color palette state (now mutable, includes custom colors)
  const [paletteColors, setPaletteColors] = useState<string[]>([...INITIAL_TAILWIND_COLORS]);

  // Tool state: "pen", "eraser", "pan", "fill"
  const [tool, setTool] = useState<Tool>("pen");

  // Pen/Eraser size state
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_SIZE);

  // --- SIZE MENU POPUP STATE ---
  const [showSizeMenu, setShowSizeMenu] = useState<boolean>(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  // PAN state
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false); // for spacebar temp pan
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

  // PNG export state
  const [exportRes, setExportRes] = useState<number>(EXPORT_DEFAULT);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // --- NEW: Export menu popup state and ref
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  // --- NEW: Grid resize menu popup state and ref
  const [showResizeMenu, setShowResizeMenu] = useState<boolean>(false);
  const resizeMenuRef = useRef<HTMLDivElement>(null);
  const resizeButtonRef = useRef<HTMLButtonElement>(null);

  // --- NEW: Grid lines toggle state
  const [showGridLines, setShowGridLines] = useState<boolean>(true);

  // --- HOVER STATE LOGIC ---
  // Track the cell currently hovered (row, col), or null if none
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);

  // --- UNDO/REDO LOGIC ---
  // Use refs for undo/redo stacks to avoid lag and race conditions
  const undoStack = useRef<string[][][]>([]);
  const redoStack = useRef<string[][][]>([]);
  // Dummy state to force re-render when undo/redo changes
  const [, forceUpdate] = useState(0);

  // --- GROUPED UNDO LOGIC ---
  // For grouping all paint actions in a single mouse drag into one undo step
  const dragStartGrid = useRef<string[][] | null>(null);
  const isDragPainting = useRef<boolean>(false);

  // Helper to push current grid to undo stack and clear redo stack
  const pushUndo = useCallback((newGrid: string[][]) => {
    undoStack.current.push(grid.map((row) => [...row]));
    redoStack.current = [];
    setGrid(newGrid);
    forceUpdate((v) => v + 1);
  }, [grid]);

  // Helper to push a grouped undo (for drag paint)
  const pushGroupedUndo = useCallback((startGrid: string[][], endGrid: string[][]) => {
    undoStack.current.push(startGrid.map((row) => [...row]));
    redoStack.current = [];
    setGrid(endGrid);
    forceUpdate((v) => v + 1);
  }, []);

  // --- RESIZE MENU STATE ---
  // Local state for the resize menu's width/height inputs
  const [resizeWidth, setResizeWidth] = useState<number>(gridWidth);
  const [resizeHeight, setResizeHeight] = useState<number>(gridHeight);

  // When grid size changes, resize the grid and preserve pixels, and clear undo/redo
  // (for the resize menu, we use a handler that applies the resize on input change)
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

  // For the top menu (old direct input), keep handlers for legacy/hidden use

  // Paint a cell at (row, col) with brush size
  // If grouping, do not push to undo stack on every cell
  const paintCell = (row: number, col: number, { group = false } = {}) => {
    let colorToApply = selectedColor;
    if (tool === "eraser") colorToApply = "transparent";
    // Paint a square of brushSize x brushSize centered at (row, col)
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
        // For grouped painting, just update grid, don't push to undo stack
        setGrid(newGrid);
      } else {
        pushUndo(newGrid);
      }
    }
  };

  // --- FILL TOOL LOGIC ---
  // Flood fill algorithm (4-way)
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

  // Mouse event handlers for painting and fill
  const handleCellMouseDown = (row: number, col: number) => {
    if (tool === "pan" || isPanMode) return;
    if (tool === "fill") {
      floodFill(row, col, selectedColor);
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
    if (isPainting && isDragPainting.current) {
      paintCell(row, col, { group: true });
    }
    setHoverCell({ row, col });
  };

  // When mouse leaves a cell, clear hover if not entering another cell
  const handleCellMouseLeave = (row: number, col: number) => {
    // Only clear if this is the cell currently hovered
    setHoverCell((prev) => {
      if (prev && prev.row === row && prev.col === col) return null;
      return prev;
    });
  };

  // End painting on mouse up or when mouse leaves the canvas
  const handleMouseUp = () => {
    if (isPainting && isDragPainting.current && dragStartGrid.current) {
      // Only push to undo stack if grid actually changed
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

  // Prevent painting from sticking if mouse leaves the canvas while pressed
  const handleMouseLeave = () => {
    if (isPainting && isDragPainting.current && dragStartGrid.current) {
      // Only push to undo stack if grid actually changed
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

  // Undo/Redo handlers (now using refs for instant response)
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

  // Handle zoom with scroll wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Only zoom if ctrl is not pressed (to avoid interfering with browser zoom)
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

  // Optionally, allow zoom in/out with +/- buttons
  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))));

  // --- RECTANGULAR GRID LOGIC ---
  // The canvas size should adapt to the grid's aspect ratio.
  // We'll keep the *shortest* side at CANVAS_SIZE, and scale the other to match the aspect ratio.
  const CANVAS_SIZE = 512; // px, 32rem = 512px
  let canvasWidth = CANVAS_SIZE;
  let canvasHeight = CANVAS_SIZE;
  if (gridWidth > gridHeight) {
    canvasWidth = CANVAS_SIZE;
    canvasHeight = Math.round(CANVAS_SIZE * (gridHeight / gridWidth));
  } else if (gridHeight > gridWidth) {
    canvasHeight = CANVAS_SIZE;
    canvasWidth = Math.round(CANVAS_SIZE * (gridWidth / gridHeight));
  }

  // --- PAN LIMIT LOGIC ---
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

  // PAN: handle mouse down on canvas for panning
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(tool === "pan" || isPanMode)) return;
    setIsPanning(true);
    panStart.current = { ...pan };
    mouseStart.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  // PAN: handle mouse move for panning
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

  // When zoom or grid size changes, clamp pan so canvas doesn't "jump" out of bounds
  useEffect(() => {
    const { minX, maxX, minY, maxY } = getPanBounds(zoom);
    setPan((prev) => ({
      x: clamp(prev.x, minX, maxX),
      y: clamp(prev.y, minY, maxY),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, gridWidth, gridHeight, canvasWidth, canvasHeight]);

  // Attach global mouseup listener to handle mouseup outside the canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPainting && isDragPainting.current && dragStartGrid.current) {
        // Only push to undo stack if grid actually changed
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
    // eslint-disable-next-line
  }, [grid, gridWidth, gridHeight, pushGroupedUndo]);

  // Hide color palette when clicking outside
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

  // Hide export menu when clicking outside
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

  // Hide resize menu when clicking outside
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

  // Hide size menu when clicking outside
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

  // Keyboard shortcut: press space to toggle pan mode (temporary pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPanMode(true);
      }
      // Undo/Redo shortcuts: Ctrl+Z, Ctrl+Y
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
    // eslint-disable-next-line
  }, [grid, handleUndo, handleRedo]);

  // Remove: If color palette is opened, always switch to pen tool
  // (No longer switch to pen when opening color palette)

  // Helper: get Tailwind class for border color
  function getCellBorderClasses(rowIdx: number, colIdx: number) {
    if (!showGridLines) return "";
    let classes = "";
    if (colIdx < gridWidth - 1) classes += " border-r border-gray-300";
    if (rowIdx < gridHeight - 1) classes += " border-b border-gray-300";
    return classes;
  }



  // Helper: get Tailwind class for color button border
  function getColorButtonBorderClass(color: string) {
    return selectedColor === color
      ? "border-2 border-gray-400"
      : "border border-gray-400";
  }

  

  // Helper: determine if a cell is hovered (for brush size)
  function isCellHovered(row: number, col: number) {
    if (!hoverCell) return false;
    const half = Math.floor(brushSize / 2);
    const startRow = hoverCell.row - half;
    const endRow = hoverCell.row + (brushSize - half) - 1;
    const startCol = hoverCell.col - half;
    const endCol = hoverCell.col + (brushSize - half) - 1;
    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }

  // Helper: get hover style for a cell
  function getCellHoverStyle(row: number, col: number, color: string) {
    if (!isCellHovered(row, col)) return {};
    // If eraser tool is selected, show as if the hovered blocks have no color (fully transparent)
    if (tool === "eraser") {
      return {
        opacity: 0.3,
        transition: "opacity 0.12s",
      };
    }
    // For transparent, use a different checkerboard
    if (color === "transparent") {
      return {
        backgroundColor: tailwindClassToHex(selectedColor),
        filter: "brightness(1.08)",
      };
    }
    // For colored cells, slightly lighten or darken
    const origHex = tailwindClassToHex(color);
    // If color is very light, darken; if dark, lighten
    let amount = 24;
    // Check if color is light
    const r = parseInt(origHex.slice(1, 3), 16);
    const g = parseInt(origHex.slice(3, 5), 16);
    const b = parseInt(origHex.slice(5, 7), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance > 180) amount = -24;
    const hoverHex = adjustHexColor(origHex, amount);
    return {
      backgroundColor: hoverHex,
      filter: "brightness(1.08)",
      transition: "background-color 0.12s, filter 0.12s",
    };
  }

  // PNG EXPORT LOGIC
  function handleExportPNG() {
    setIsExporting(true);

    // Calculate canvas width and height to match grid aspect ratio
    // The longer side is exportRes, the shorter is scaled to match aspect ratio
    let outWidth = exportRes;
    let outHeight = exportRes;
    if (gridWidth > gridHeight) {
      outWidth = exportRes;
      outHeight = Math.round(exportRes * (gridHeight / gridWidth));
    } else if (gridHeight > gridWidth) {
      outHeight = exportRes;
      outWidth = Math.round(exportRes * (gridWidth / gridHeight));
    }
    // If grid is square, both are exportRes

    // --- FIX: Avoid grid lines in export by rounding cell edges outward ---
    // Instead of using floating point cellWidth/cellHeight directly, we round the pixel edges outward
    // so that every pixel is covered, and no gaps appear between cells.

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

    // Draw each cell using integer-rounded edges
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const color = grid[row][col];
        const x = cellEdgesX[col];
        const y = cellEdgesY[row];
        const w = cellEdgesX[col + 1] - cellEdgesX[col];
        const h = cellEdgesY[row + 1] - cellEdgesY[row];
        if (color === "transparent") {
          // Do nothing, leave transparent pixel
          continue;
        } else {
          ctx.fillStyle = tailwindClassToHex(color);
          ctx.fillRect(x, y, w, h);
        }
        // Do NOT draw grid lines in export
      }
    }

    // Download as PNG
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

  // Generate slider marks for export resolutions
  const exportMarks: number[] = [];
  for (let i = EXPORT_MIN; i <= EXPORT_MAX; i += EXPORT_STEP) {
    exportMarks.push(i);
  }

  // For rendering, get undo/redo stack lengths from refs
  const undoStackLength = undoStack.current.length;
  const redoStackLength = redoStack.current.length;

  // For display, show the actual export size (WxH) in the UI
  let exportDisplayWidth = exportRes;
  let exportDisplayHeight = exportRes;
  if (gridWidth > gridHeight) {
    exportDisplayWidth = exportRes;
    exportDisplayHeight = Math.round(exportRes * (gridHeight / gridWidth));
  } else if (gridHeight > gridWidth) {
    exportDisplayHeight = exportRes;
    exportDisplayWidth = Math.round(exportRes * (gridWidth / gridHeight));
  }

  // Helper: get a style for the custom color button

  // Helper: check if selectedColor is a custom color (not in paletteColors)

  // Handler to add a custom color to the palette and select it
  const handleAddCustomColor = () => {
    // Only add if not already present
    if (!paletteColors.includes(customColor)) {
      setPaletteColors((prev) => [...prev, customColor]);
    }
    setSelectedColor(customColor);
    setShowColorPalette(false);
    setShowCustomColorPicker(false);
  };

  // Handler to open the custom color picker
  const handleShowCustomColorPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCustomColorPicker((v) => !v);
  };

  // Helper: get style for the color preview button in the bottom menu
  function getBottomMenuColorPreviewStyle() {
    // If selectedColor is a palette color and a Tailwind class, use class
    if (selectedColor.startsWith("bg-")) {
      return undefined;
    }
    // If selectedColor is a custom color (hex), use inline style
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
    // fallback
    return undefined;
  }

  // --- NEW: Helper to get "selected" style for top menu buttons (resize/export/grid lines) ---
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

  // --- Helper: get a styled zoom display for the top menu ---
  function getZoomDisplay() {
    // Use a rounded badge with a subtle background and bold text
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

  // --- Helper: for no grid lines, avoid pixel gaps by using flexbox and no borders ---
  function renderCanvasCells() {
    if (showGridLines) {
      // Use grid layout with borders
      return grid.map((row, rowIdx) =>
        row.map((color, colIdx) => {
          const isTransparent = color === "transparent";
          const isCustom = color.startsWith("#");
          return (
            <div
              key={`${rowIdx}-${colIdx}`}
              onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
              onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
              onMouseLeave={() => handleCellMouseLeave(rowIdx, colIdx)}
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
                ...getCellHoverStyle(rowIdx, colIdx, color),
              }}
              draggable={false}
            />
          );
        })
      );
    } else {
      // Use flexbox to avoid gaps, and no borders
      // Each row is a flex row, each cell is a flex item, width/height 100%
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
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
                onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                onMouseLeave={() => handleCellMouseLeave(rowIdx, colIdx)}
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
                  ...getCellHoverStyle(rowIdx, colIdx, color),
                  // Remove border, and set display block to avoid inline gap
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

  // --- Helper: get icon for brush size ---
  function getBrushSizeIcon(size: number) {
    if (size === 1) return <SquareIcon size={26} />;
    if (size === 2) return <Grid2X2Icon size={26} />;
    if (size === 3) return <Grid3X3Icon size={26} />;

    return <SquareIcon size={26} />;
  }

  // --- NEW: Helper for tool button classes and styles with hover effect ---
  // --- REWRITE: Use group/peer and custom hover logic for correct hover bg for all tool buttons ---
  function getToolButtonClass(toolName: Tool, selected: boolean) {
    // The base border color for each tool
    let selectedBg = "";
    let selectedBorder = "";
    let hoverBg = "";
    let hoverBorder = "";
    switch (toolName) {
      case "pen":
        selectedBg = "bg-green-300"; // changed from green-200 to green-300
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
    // We'll use a group class and apply the hover bg/border via a custom style below
    return `border rounded px-3 py-1 font-mono flex items-center gap-2 transition group ${selected ? `${selectedBg} ${selectedBorder}` : `bg-white border-gray-200`}`;
  }
  function getToolButtonStyle(toolName: Tool, selected: boolean, hovered: boolean) {
    // Box shadow color for each tool
    let selectedShadow = "";
    let hoverBg = "";
    let selectedBg = "";
    let selectedBorder = "";
    switch (toolName) {
      case "pen":
        selectedShadow = "0 1px 4px rgba(134,239,172,0.4)"; // green-300
        hoverBg = "#bbf7d0"; // Tailwind green-200
        selectedBg = "#86efac"; // Tailwind green-300
        selectedBorder = "#4ade80"; // Tailwind green-400
        break;
      case "eraser":
        selectedShadow = "0 1px 4px rgba(253,224,71,0.4)";
        hoverBg = "#fef9c3"; // Tailwind yellow-100
        selectedBg = "#fef08a"; // Tailwind yellow-200
        selectedBorder = "#facc15"; // Tailwind yellow-400
        break;
      case "fill":
        selectedShadow = "0 1px 4px rgba(6,182,212,0.2)";
        hoverBg = "#cffafe"; // Tailwind cyan-100
        selectedBg = "#a5f3fc"; // Tailwind cyan-200
        selectedBorder = "#06b6d4"; // Tailwind cyan-400
        break;
      case "pan":
        selectedShadow = "0 1px 4px rgba(59,130,246,0.2)";
        hoverBg = "#dbeafe"; // Tailwind blue-100
        selectedBg = "#bfdbfe"; // Tailwind blue-200
        selectedBorder = "#60a5fa"; // Tailwind blue-400
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
      // Do not change borderColor on hover
    }
    return style;
  }

  // --- Track hover state for tool buttons ---
  const [toolButtonHover, setToolButtonHover] = useState<{ [key in Tool]?: boolean }>({});

  function handleToolButtonMouseEnter(toolName: Tool) {
    setToolButtonHover((prev) => ({ ...prev, [toolName]: true }));
  }
  function handleToolButtonMouseLeave(toolName: Tool) {
    setToolButtonHover((prev) => ({ ...prev, [toolName]: false }));
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-screen">
      <div className="fixed left-1/2 top-2 rounded -translate-x-1/2 h-16 bg-white/60 border-white/80 border-2 flex items-center justify-center gap-4 px-4 z-40">
        
        {/* --- UNDO/REDO BUTTONS --- */}
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
        </div>

        {/* --- GRID RESIZE BUTTON (dropdown) --- */}
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

        {/* --- GRID LINES TOGGLE BUTTON --- */}
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
        
        {/* --- ZOOM CONTROLS  --- */}
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
        {/* --- PNG EXPORT BUTTON (single button, opens export menu) --- */}
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
      {/* --- RESIZE MENU POPUP --- */}
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
      {/* --- EXPORT MENU POPUP --- */}
      {showExportMenu && (
        <div
          ref={exportMenuRef}
          className="fixed left-1/2 top-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-4 items-center"
        >
          <div className="flex flex-col gap-4 items-center">
            <label className="font-mono text-sm flex items-center gap-2">
              <span>Export PNG size:</span>
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
      {/* --- SIZE MENU POPUP --- */}
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
      {/* --- END TOP MENU --- */}

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
                : (tool === "fill"
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

      {/* Color palette popup */}
      {showColorPalette && (
        <div
          ref={paletteRef}
          className="fixed left-1/2 bottom-20 -translate-x-1/2 z-50 bg-white/60 border-white/80 border-2 rounded flex flex-col p-2 items-center"
        >
          <div className="flex gap-2 items-center">
            {/* Render all palette colors to the left of the add new color button */}
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
            {/* Divider */}
            <span className="mx-2 text-gray-400 select-none" style={{ fontWeight: 600, fontSize: 18 }}>|</span>
            {/* Add new color button */}
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
          {/* Custom color picker input, shown below the palette if toggled */}
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
              // Do not setTool("pen") here; just toggle palette
            }}
            className={
              selectedColor.startsWith("bg-")
                ? `${selectedColor} border-gray-200 mr-2 w-10 h-10 rounded-md cursor-pointer outline-none shadow ${tool === "eraser" ? "opacity-50" : ""}`
                : `border-gray-200 w-10 h-10 rounded-md cursor-pointer outline-none shadow ${(tool === "eraser" || tool === "pan") ? "opacity-50" : ""}`
            }
            aria-label="Show color palette"
            style={getBottomMenuColorPreviewStyle()}
          />
          {/* PEN BUTTON */}
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
          {/* ERASER BUTTON */}
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
          {/* FILL BUTTON */}
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
          {/* PAN BUTTON */}
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
          {/* SIZE BUTTON (opens popup) */}
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
        {/* ZOOM CONTROLS REMOVED FROM BOTTOM MENU */}
      </div>
    </div>
  );
}
