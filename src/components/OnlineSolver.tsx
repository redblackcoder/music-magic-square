import { useState, useCallback, useMemo } from 'react';
import type { CellValue } from '../types';
import { parseInput, textToSixteenths } from '../parseInput';

interface OnlineSolverProps {
  onCapture: (values: CellValue[][]) => void;
  onClose: () => void;
}

interface LineDef {
  label: string;
  cells: [number, number][];
}

const LINES: LineDef[] = [
  // rows
  { label: 'R1', cells: [[0,0],[0,1],[0,2],[0,3]] },
  { label: 'R2', cells: [[1,0],[1,1],[1,2],[1,3]] },
  { label: 'R3', cells: [[2,0],[2,1],[2,2],[2,3]] },
  { label: 'R4', cells: [[3,0],[3,1],[3,2],[3,3]] },
  // columns
  { label: 'C1', cells: [[0,0],[1,0],[2,0],[3,0]] },
  { label: 'C2', cells: [[0,1],[1,1],[2,1],[3,1]] },
  { label: 'C3', cells: [[0,2],[1,2],[2,2],[3,2]] },
  { label: 'C4', cells: [[0,3],[1,3],[2,3],[3,3]] },
  // diagonals
  { label: 'D\\', cells: [[0,0],[1,1],[2,2],[3,3]] },
  { label: 'D/', cells: [[0,3],[1,2],[2,1],[3,0]] },
];

interface LineStatus {
  sum: number;
  filled: number;
  allUnique: boolean;
  valid: boolean;
}

function computeLineStatus(line: LineDef, cells: string[][]): LineStatus {
  const values = line.cells.map(([r, c]) => textToSixteenths(cells[r][c]));
  const validValues = values.filter((v): v is number => v !== null);
  const sum = validValues.reduce((a, b) => a + b, 0);
  const filled = validValues.length;
  const allUnique = new Set(validValues).size === filled;
  const valid = sum === 16 && filled === 4 && allUnique;
  return { sum, filled, allUnique, valid };
}

function SumBadge({ status, label }: { status: LineStatus; label: string }) {
  return (
    <div className={`solver-sum ${status.valid ? 'sum-valid' : 'sum-invalid'}`}>
      <span className="solver-sum-label">{label}</span>
      <span className="solver-sum-value">{status.sum}/16</span>
    </div>
  );
}

export default function OnlineSolver({ onCapture, onClose }: OnlineSolverProps) {
  const [cells, setCells] = useState<string[][]>(
    () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ''))
  );

  const lineStatuses = useMemo(
    () => LINES.map(line => computeLineStatus(line, cells)),
    [cells],
  );

  const allCellsValid = useMemo(
    () => cells.every(row => row.every(text => parseInput(text) !== null)),
    [cells],
  );

  const handleCellChange = useCallback((r: number, c: number, value: string) => {
    setCells(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = value;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!allCellsValid) return;
    const values = cells.map(row => row.map(text => parseInput(text)!));
    onCapture(values);
  }, [cells, allCellsValid, onCapture]);

  return (
    <div className="camera-container">
      <div className="solver-overlay">
        <div className="solver-header">
          <h2>Online Solver</h2>
          <button className="solver-close-btn" onClick={onClose}>Close</button>
        </div>

        <div className="solver-body">
          {/* Diagonal sums above grid */}
          <div className="solver-diag-sums">
            <SumBadge status={lineStatuses[8]} label="D\" />
            <SumBadge status={lineStatuses[9]} label="D/" />
          </div>

          <div className="solver-grid-area">
            <div className="solver-grid">
              {cells.map((row, r) =>
                row.map((text, c) => {
                  const sixteenths = textToSixteenths(text);
                  const isEmpty = text.replace(/\s/g, '') === '';
                  const isValid = sixteenths !== null;
                  const cls = isEmpty ? '' : isValid ? 'valid-cell' : 'invalid-cell';
                  return (
                    <input
                      key={`${r}-${c}`}
                      className={`solver-cell ${cls}`}
                      type="text"
                      inputMode="tel"
                      value={text}
                      onChange={(e) => handleCellChange(r, c, e.target.value)}
                    />
                  );
                })
              )}
            </div>

            {/* Row sums to the right */}
            <div className="solver-row-sums">
              {[0, 1, 2, 3].map(i => (
                <SumBadge key={i} status={lineStatuses[i]} label={`R${i + 1}`} />
              ))}
            </div>
          </div>

          {/* Column sums below */}
          <div className="solver-col-sums">
            {[4, 5, 6, 7].map(i => (
              <SumBadge key={i} status={lineStatuses[i]} label={`C${i - 3}`} />
            ))}
          </div>

          <p className="solver-hint">Enter values 1–10 or expressions like 1+2, 4+8</p>
        </div>

        <div className="solver-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!allCellsValid}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
