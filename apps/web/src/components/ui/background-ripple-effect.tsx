"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "../../lib/utils";

export const BackgroundRippleEffect = ({
  rows = 15,
  cols = 30,
  cellSize = 64,
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
}) => {
  const [clickedCell, setClickedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [rippleKey, setRippleKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ rows, cols });

  // Dynamically calculate rows and cols based on viewport
  useEffect(() => {
    const updateDimensions = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDimensions({
        cols: Math.ceil(w / cellSize) + 1,
        rows: Math.ceil(h / cellSize) + 1,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [cellSize]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 h-full w-full z-0 overflow-hidden bg-background",
        "[--cell-border-color:rgba(255,255,255,0.08)] [--cell-fill-color:transparent] [--cell-shadow-color:rgba(255,255,255,0.03)]",
        "dark:[--cell-border-color:rgba(255,255,255,0.08)] dark:[--cell-shadow-color:rgba(0,0,0,0.3)]",
        "light:[--cell-border-color:rgba(0,0,0,0.06)] light:[--cell-shadow-color:rgba(0,0,0,0.03)]"
      )}
    >
      <div className="relative h-full w-full overflow-hidden flex items-center justify-center">
        <DivGrid
          key={`base-${rippleKey}`}
          className="opacity-40"
          rows={dimensions.rows}
          cols={dimensions.cols}
          cellSize={cellSize}
          borderColor="var(--cell-border-color)"
          fillColor="var(--cell-fill-color)"
          clickedCell={clickedCell}
          onCellClick={(row, col) => {
            setClickedCell({ row, col });
            setRippleKey((k) => k + 1);
          }}
          interactive
        />
        {/* Soft Masking for better focus on content */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_100%)]" />
      </div>
    </div>
  );
};

type DivGridProps = {
  className?: string;
  rows: number;
  cols: number;
  cellSize: number;
  borderColor: string;
  fillColor: string;
  clickedCell: { row: number; col: number } | null;
  onCellClick?: (row: number, col: number) => void;
  interactive?: boolean;
};

type CellStyle = React.CSSProperties & {
  ["--delay"]?: string;
  ["--duration"]?: string;
};

const DivGrid = ({
  className,
  rows,
  cols,
  cellSize,
  borderColor,
  fillColor,
  clickedCell,
  onCellClick,
  interactive,
}: DivGridProps) => {
  const cells = useMemo(
    () => Array.from({ length: rows * cols }, (_, idx) => idx),
    [rows, cols]
  );

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
    width: cols * cellSize,
    height: rows * cellSize,
  };

  return (
    <div className={cn("relative", className)} style={gridStyle}>
      {cells.map((idx) => {
        const rowIdx = Math.floor(idx / cols);
        const colIdx = idx % cols;
        const distance = clickedCell
          ? Math.hypot(clickedCell.row - rowIdx, clickedCell.col - colIdx)
          : 0;
        const delay = clickedCell ? Math.max(0, distance * 40) : 0;
        const duration = 300 + distance * 60;

        const style: CellStyle = clickedCell
          ? {
              "--delay": `${delay}ms`,
              "--duration": `${duration}ms`,
            }
          : {};

        return (
          <div
            key={idx}
            className={cn(
              "cell relative border-[0.5px] transition-all duration-300 hover:bg-primary-500/10 hover:border-primary-500/30",
              clickedCell && "animate-cell-ripple [animation-fill-mode:none]",
              !interactive && "pointer-events-none"
            )}
            style={{
              backgroundColor: fillColor,
              borderColor: borderColor,
              ...style,
            }}
            onClick={interactive ? () => onCellClick?.(rowIdx, colIdx) : undefined}
          />
        );
      })}
    </div>
  );
};
