import { useRef, useEffect, useState, useCallback } from 'react';
import type { CellValue, NoteDuration } from '../types';
import type { ScanResult, CellConfidence } from '../imageProcessing';

interface CameraProps {
  onCapture: (values: CellValue[][]) => void;
  onClose: () => void;
}

const DUR_TO_NUM: Record<NoteDuration, string> = {
  '1/16': '1',
  '1/8': '2',
  '1/4': '4',
  '1/2': '8',
};

const NUM_TO_DUR: Record<string, NoteDuration> = {
  '1': '1/16',
  '2': '1/8',
  '4': '1/4',
  '8': '1/2',
};

const VALID_SINGLES = new Set(['1', '2', '4', '8']);
const VALID_PAIRS: Record<string, [string, string]> = {
  '1+2': ['1', '2'], '1+4': ['1', '4'], '1+8': ['1', '8'],
  '2+4': ['2', '4'], '2+8': ['2', '8'], '4+8': ['4', '8'],
  '2+1': ['1', '2'], '4+1': ['1', '4'], '8+1': ['1', '8'],
  '4+2': ['2', '4'], '8+2': ['2', '8'], '8+4': ['4', '8'],
};

// Compound values (sum of sixteenths) → tied pair decomposition
const COMPOUND_TO_PAIR: Record<string, [string, string]> = {
  '3': ['1', '2'], '5': ['1', '4'], '6': ['2', '4'],
  '9': ['1', '8'], '10': ['2', '8'],
};

// Triple-tied compound value
const COMPOUND_TRIPLE: Record<string, [string, string, string]> = {
  '7': ['4', '2', '1'],
};

/** Low confidence threshold — cells below this get highlighted */
const LOW_CONFIDENCE = 0.80;

function cellLabel(v: CellValue): string {
  if (v.kind === 'single' || v.kind === 'rest') return DUR_TO_NUM[v.dur] ?? '?';
  if (v.kind === 'triple' || v.kind === 'restTriple')
    return `${DUR_TO_NUM[v.first] ?? '?'}+${DUR_TO_NUM[v.second] ?? '?'}+${DUR_TO_NUM[v.third] ?? '?'}`;
  return `${DUR_TO_NUM[v.first] ?? '?'}+${DUR_TO_NUM[v.second] ?? '?'}`;
}

/** Parse a text string like "4", "1+2", or "3" into a CellValue, or null if invalid */
function parseInput(text: string): CellValue | null {
  const clean = text.replace(/\s/g, '');
  if (VALID_SINGLES.has(clean) && NUM_TO_DUR[clean]) {
    return { kind: 'single', dur: NUM_TO_DUR[clean] };
  }
  const triple = COMPOUND_TRIPLE[clean];
  if (triple) {
    return { kind: 'triple', first: NUM_TO_DUR[triple[0]], second: NUM_TO_DUR[triple[1]], third: NUM_TO_DUR[triple[2]] };
  }
  const compound = COMPOUND_TO_PAIR[clean];
  if (compound) {
    return { kind: 'tied', first: NUM_TO_DUR[compound[0]], second: NUM_TO_DUR[compound[1]] };
  }
  const pair = VALID_PAIRS[clean];
  if (pair) {
    return { kind: 'tied', first: NUM_TO_DUR[pair[0]], second: NUM_TO_DUR[pair[1]] };
  }
  return null;
}

function isLowConfidence(conf: CellConfidence): boolean {
  return conf.confidence < LOW_CONFIDENCE || conf.source === 'default';
}

export default function Camera({ onCapture, onClose }: CameraProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Editable cell text values (digit strings like "4", "1+2")
  const [editedTexts, setEditedTexts] = useState<string[][]>([]);
  // Track which cell is being edited (row, col) or null
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  // Track which cells have been manually edited (removes orange highlight)
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  // Store captured image base64 for debug download
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);

  // Auto-open file picker on mount
  useEffect(() => {
    // Small delay to ensure the component is mounted before triggering
    const timer = setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Initialize editable texts from scan result
  useEffect(() => {
    if (!scanResult) return;
    setEditedTexts(
      scanResult.values.map((row) => row.map((cell) => cellLabel(cell)))
    );
  }, [scanResult]);

  /** Send a base64 JPEG to the scan API and set the result. */
  const sendToScanApi = useCallback(async (base64: string, sourceImage: ImageData) => {
    setScanStage('Processing...');
    setCapturedBase64(base64);

    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const result = await response.json();

    setScanResult({
      values: result.values,
      confidences: result.confidences,
      sourceImage,
      gridFound: result.gridFound,
      quadCorners: result.quadCorners,
      warpedImage: sourceImage,
    });
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || scanning) return;

    setScanning(true);
    setError(null);
    setScanStage('Reading image...');

    try {
      // Read file as base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];

      // Also create ImageData for preview
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const sourceImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

      await sendToScanApi(base64, sourceImage);
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [scanning, sendToScanApi]);

  // Check if all edited cells are valid
  const allValid = editedTexts.length === 4 && editedTexts.every(
    (row) => row.length === 4 && row.every((text) => parseInput(text) !== null)
  );

  const handleAccept = useCallback(() => {
    if (!allValid) return;
    const values = editedTexts.map((row) =>
      row.map((text) => parseInput(text)!)
    );
    onCapture(values);
  }, [editedTexts, allValid, onCapture]);

  const handleRetry = useCallback(() => {
    setScanResult(null);
    setEditedTexts([]);
    setEditingCell(null);
    setEditedCells(new Set());
    setCapturedBase64(null);
    setError(null);
    // Open file picker again
    setTimeout(() => fileInputRef.current?.click(), 100);
  }, []);

  const handleDownloadImage = useCallback(() => {
    if (!capturedBase64) return;
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${capturedBase64}`;
    link.download = `scan_${Date.now()}.jpg`;
    link.click();
  }, [capturedBase64]);

  const handleCellClick = useCallback((r: number, c: number) => {
    setEditingCell([r, c]);
  }, []);

  const handleCellChange = useCallback((r: number, c: number, value: string) => {
    setEditedTexts((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = value;
      return next;
    });
    setEditedCells((prev) => {
      const next = new Set(prev);
      next.add(`${r}-${c}`);
      return next;
    });
  }, []);

  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
    }
  }, []);

  // Hidden file input — always present
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      style={{ display: 'none' }}
      onChange={handleUpload}
    />
  );

  // Preview/confirmation screen
  if (scanResult && editedTexts.length === 4) {
    return (
      <div className="camera-container">
        {fileInput}
        <div className="scan-preview">
          <div className="scan-preview-header">
            <h2>Scan Result</h2>
            <span className={`scan-status ${scanResult.gridFound ? 'status-ok' : 'status-warn'}`}>
              {scanResult.gridFound ? 'Grid detected' : 'Grid not found — used fallback'}
            </span>
          </div>

          <div className="scan-preview-body">
            <div className="scan-preview-grid">
              <p className="scan-preview-label">Recognized values:</p>
              <div className="scan-grid">
                {editedTexts.flatMap((row, r) =>
                  row.map((text, c) => {
                    const conf = scanResult.confidences[r][c];
                    const valid = parseInput(text) !== null;
                    const lowConf = isLowConfidence(conf) && !editedCells.has(`${r}-${c}`);
                    const isEditing = editingCell?.[0] === r && editingCell?.[1] === c;

                    const classes = [
                      'scan-grid-cell',
                      lowConf && !isEditing ? 'low-confidence' : '',
                      !valid ? 'invalid' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <div
                        key={`${r}-${c}`}
                        className={classes}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            inputMode="tel"
                            autoFocus
                            value={text}
                            onChange={(e) => handleCellChange(r, c, e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                          />
                        ) : (
                          text
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="scan-grid-hint">Tap any cell to edit. Orange cells need review.</p>
            </div>
          </div>

          <div className="scan-preview-actions">
            <button className="btn-secondary" onClick={handleRetry}>Retry</button>
            {(import.meta.env.VITE_DEBUG_MODE === 'true' || import.meta.env.VITE_APP_ENV === 'dev') && (
              <button className="btn-secondary" onClick={handleDownloadImage}>Save Image</button>
            )}
            <button className="btn-primary" onClick={handleAccept} disabled={!allValid}>Accept</button>
          </div>
        </div>
      </div>
    );
  }

  // Upload prompt screen
  return (
    <div className="camera-container">
      {fileInput}
      {error ? (
        <div className="camera-error">
          <p>{error}</p>
          <div className="scan-preview-actions">
            <button className="btn-secondary" onClick={handleRetry}>Retry</button>
            {capturedBase64 && (import.meta.env.VITE_DEBUG_MODE === 'true' || import.meta.env.VITE_APP_ENV === 'dev') && (
              <button className="btn-secondary" onClick={handleDownloadImage}>Save Image</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : scanning ? (
        <div className="camera-upload-prompt">
          <div className="scan-progress">
            <p>{scanStage}</p>
          </div>
        </div>
      ) : (
        <div className="camera-upload-prompt">
          <div className="upload-prompt-content">
            <div className="upload-icon">&#128247;</div>
            <h2>Scan Your Grid</h2>
            <p>Take a photo of your 4×4 grid, or choose an existing image.</p>
            <div className="upload-prompt-actions">
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                Take Photo / Choose Image
              </button>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
