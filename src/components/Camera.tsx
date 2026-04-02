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

/**
 * Guide overlay fraction — sized from physical scanning geometry.
 *
 * Physical model:
 *   - Paper grid:  ~13 cm square (user-confirmed 12–15 cm range)
 *   - Distance:    ~30 cm  (comfortable arm-above-desk position)
 *   - Rear camera: 26 mm equivalent focal length (iPhone / most Android)
 *   - Video:       16:9 portrait (common getUserMedia output)
 *
 * FOV derivation (26 mm equiv on 36×24 mm full-frame reference):
 *   Landscape HFOV = 2·atan(36 / (2·26)) ≈ 69°
 *   16:9 crop VFOV = 2·atan(20.25 / (2·26)) ≈ 42.5°
 *   In portrait the narrow axis has the 42.5° FOV.
 *
 *   Visible width at 30 cm = 2 · 30 · tan(42.5°/2) ≈ 23.3 cm
 *   13 cm grid → occupies 13 / 23.3 ≈ 56 % of horizontal frame
 *
 * With default digital zoom (some phones apply 1.5×):
 *   Effective visible width ≈ 15.5 cm → grid occupies 84 % — barely fits.
 *   Fix: request zoom = min via applyConstraints (see startCamera below).
 *
 * Guide at 0.65 means the overlay is 65 % of viewport's smaller dimension.
 * This matches CSS `65vmin` and maximises the captured area while still
 * leaving margin for alignment tolerance. The 10 % capture padding further
 * extends the crop sent to the backend.
 */
const GUIDE_FRACTION = 0.65;

/** Low confidence threshold — cells below this get highlighted */
const LOW_CONFIDENCE = 0.80;

function cellLabel(v: CellValue): string {
  if (v.kind === 'single' || v.kind === 'rest') return DUR_TO_NUM[v.dur] ?? '?';
  return `${DUR_TO_NUM[v.first] ?? '?'}+${DUR_TO_NUM[v.second] ?? '?'}`;
}

/** Parse a text string like "4" or "1+2" into a CellValue, or null if invalid */
function parseInput(text: string): CellValue | null {
  const clean = text.replace(/\s/g, '');
  if (VALID_SINGLES.has(clean) && NUM_TO_DUR[clean]) {
    return { kind: 'single', dur: NUM_TO_DUR[clean] };
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

const GHOST_NUMBERS = [
  ['8', '4', '1', '2+1'],
  ['1', '2+1', '8', '4'],
  ['2+1', '1', '4', '8'],
  ['4', '8', '2+1', '1'],
];

export default function Camera({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
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

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Request minimum zoom to get the widest possible field of view.
        // Many phones (especially Samsung) default to 1.5–2× digital zoom
        // in the browser, which narrows the FOV from ~42° to ~28° in
        // portrait and forces the user to hold the phone much further away.
        // Resetting to zoom.min restores the native 26 mm-equiv FOV.
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities?.zoom) {
          try {
            await track.applyConstraints({
              advanced: [{ zoom: capabilities.zoom.min } as MediaTrackConstraintSet],
            });
          } catch {
            // zoom constraint not supported on this device — no-op
          }
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.onloadedmetadata = () => {
            video.play();
            setReady(true);
          };
          video.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setError('Camera access denied. Please allow camera permission and try again.');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Initialize editable texts from scan result
  useEffect(() => {
    if (!scanResult) return;
    setEditedTexts(
      scanResult.values.map((row) => row.map((cell) => cellLabel(cell)))
    );
  }, [scanResult]);

  /** Send a base64 JPEG + sourceImage to the scan API and set the result. */
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

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || scanning) return;

    setScanning(true);
    setScanStage('Sending to server...');

    try {
      // Map the guide overlay from display coordinates to video pixel
      // coordinates.  The video element uses object-fit: contain, meaning
      // the entire video is visible with letterboxing on one axis.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const dispW = video.clientWidth;
      const dispH = video.clientHeight;

      // object-fit: contain — scale so the entire video fits inside the
      // display element, letterboxing the remaining axis.
      const scale = Math.min(dispW / vw, dispH / vh);
      const renderedW = vw * scale;   // video width on screen (px)
      const renderedH = vh * scale;   // video height on screen (px)
      const offsetX = (dispW - renderedW) / 2; // letterbox offset left
      const offsetY = (dispH - renderedH) / 2; // letterbox offset top

      // Guide overlay is GUIDE_FRACTION of min(dispW, dispH), centered
      const guidePx = GUIDE_FRACTION * Math.min(dispW, dispH);
      const guideLeft = (dispW - guidePx) / 2;
      const guideTop = (dispH - guidePx) / 2;

      // Convert guide rect from display coords to video pixel coords.
      // Subtract letterbox offset, then divide by the contain scale.
      const cropX = (guideLeft - offsetX) / scale;
      const cropY = (guideTop - offsetY) / scale;
      const cropW = guidePx / scale;
      const cropH = guidePx / scale;

      // Add 10% padding to give grid detection room for edge detection
      const pad = 0.10;
      const padX = cropW * pad;
      const padY = cropH * pad;
      const finalX = Math.max(0, Math.round(cropX - padX));
      const finalY = Math.max(0, Math.round(cropY - padY));
      const finalW = Math.min(vw - finalX, Math.round(cropW + 2 * padX));
      const finalH = Math.min(vh - finalY, Math.round(cropH + 2 * padY));

      console.log(`[capture] video=${vw}x${vh} display=${dispW}x${dispH} scale=${scale.toFixed(3)} guide=${guidePx.toFixed(0)}px → crop=${finalW}x${finalH}`);

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
      const sourceImage = ctx.getImageData(0, 0, finalW, finalH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      await sendToScanApi(base64, sourceImage);
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [scanning, sendToScanApi]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || scanning) return;

    setScanning(true);
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
    // The <video> element is about to remount (it's not rendered during preview).
    // Reattach the stream on the next frame so the camera feed reappears.
    requestAnimationFrame(() => {
      const video = videoRef.current;
      const stream = streamRef.current;
      if (video && stream) {
        video.srcObject = stream;
        video.play();
      }
    });
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

  // Preview/confirmation screen
  if (scanResult && editedTexts.length === 4) {
    return (
      <div className="camera-container">
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

  return (
    <div className="camera-container">
      {error ? (
        <div className="camera-error">
          <p>{error}</p>
          <div className="scan-preview-actions">
            <button className="btn-secondary" onClick={() => { setError(null); handleRetry(); }}>Retry</button>
            {capturedBase64 && (import.meta.env.VITE_DEBUG_MODE === 'true' || import.meta.env.VITE_APP_ENV === 'dev') && (
              <button className="btn-secondary" onClick={handleDownloadImage}>Save Image</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" />

          <div className="guide-overlay">
            <div className="guide-mask guide-mask-top" />
            <div className="guide-mask guide-mask-bottom" />
            <div className="guide-mask guide-mask-left" />
            <div className="guide-mask guide-mask-right" />
            <div className="guide-grid">
              {GHOST_NUMBERS.flat().map((num, i) => (
                <div key={i} className="guide-cell">
                  <span className="guide-number">{num}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="camera-controls">
            <button className="btn-secondary" onClick={onClose} disabled={scanning}>Cancel</button>
            <button className="btn-capture" onClick={handleCapture} disabled={!ready || scanning}>
              <span className="capture-icon" />
            </button>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
          </div>

          {!ready && <div className="camera-loading">Starting camera...</div>}
          {scanning && (
            <div className="camera-loading">
              <div className="scan-progress">
                <p>{scanStage}</p>
              </div>
            </div>
          )}

          <div className="camera-hint">
            Write numbers in each cell: 1, 2, 4, 8, or tied (e.g. 1+2)
          </div>
        </>
      )}
    </div>
  );
}
