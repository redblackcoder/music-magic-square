import { useRef, useEffect, useState, useCallback } from 'react';
import {
  captureFrame,
  loadRecognizer,
  recognizeCellFromImageData,
  type ScanResult,
} from '../imageProcessing';
import { initOpenCV, detectGrid } from '../gridDetection';
import type { CellValue, NoteDuration } from '../types';
import type { CellRecognizer } from '../digitRecognizer';

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

function cellLabel(v: CellValue): string {
  if (v.kind === 'single') return DUR_TO_NUM[v.dur] ?? '?';
  return `${DUR_TO_NUM[v.first] ?? '?'}+${DUR_TO_NUM[v.second] ?? '?'}`;
}

function isGridFound(quadCorners: [number, number][]): boolean {
  const [tl, tr, br, bl] = quadCorners;
  return !(
    Math.abs(tl[1] - tr[1]) < 2 &&
    Math.abs(bl[1] - br[1]) < 2 &&
    Math.abs(tl[0] - bl[0]) < 2 &&
    Math.abs(tr[0] - br[0]) < 2
  );
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
  const recognizerRef = useRef<CellRecognizer | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [preloadDone, setPreloadDone] = useState(false);

  // Pre-load OpenCV + ONNX model eagerly on mount (while user frames the shot)
  useEffect(() => {
    let cancelled = false;

    // Use setTimeout so the camera UI renders first
    setTimeout(async () => {
      if (cancelled) return;
      console.log('[camera] pre-loading OpenCV + ONNX...');
      const t0 = performance.now();

      try {
        // Load both in parallel
        const [, recognizer] = await Promise.all([
          initOpenCV().then(() => console.log('[camera] OpenCV ready')),
          loadRecognizer().then(r => { console.log('[camera] ONNX model ready'); return r; }),
        ]);
        if (!cancelled) {
          recognizerRef.current = recognizer;
          setPreloadDone(true);
          console.log('[camera] pre-load complete in', Math.round(performance.now() - t0), 'ms');
        }
      } catch (err) {
        console.error('[camera] pre-load failed:', err);
        // Not fatal — will load on demand during scan
      }
    }, 100);

    return () => {
      cancelled = true;
      recognizerRef.current?.dispose();
      recognizerRef.current = null;
    };
  }, []);

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setReady(true);
          };
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

  // Draw preview overlay when scan result arrives
  useEffect(() => {
    if (!scanResult || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const { sourceImage, quadCorners, gridFound } = scanResult;
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;

    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(sourceImage, 0, 0);

    const [tl, tr, br, bl] = quadCorners;
    ctx.strokeStyle = gridFound ? '#00ff00' : '#ff6600';
    ctx.lineWidth = Math.max(3, sourceImage.width / 300);
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(bl[0], bl[1]);
    ctx.closePath();
    ctx.stroke();

    const labels = ['TL', 'TR', 'BR', 'BL'];
    const fontSize = Math.max(14, sourceImage.width / 50);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = gridFound ? '#00ff00' : '#ff6600';
    for (let i = 0; i < 4; i++) {
      ctx.fillText(labels[i], quadCorners[i][0] + 8, quadCorners[i][1] - 8);
    }
  }, [scanResult]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || scanning) return;

    console.log('[camera] capture pressed, preloadDone:', preloadDone);
    setScanning(true);
    setProgress(0);
    setScanStage('Detecting grid...');

    try {
      const imageData = captureFrame(video);
      console.log('[camera] frame:', imageData.width, '×', imageData.height);

      // Yield to let the UI update before heavy processing
      await new Promise(r => setTimeout(r, 50));

      // Step 1: Grid detection (OpenCV)
      console.log('[camera] running grid detection...');
      const { warped, cells, quadCorners } = await detectGrid(imageData);
      const gridFound = isGridFound(quadCorners);
      console.log('[camera] grid detected:', gridFound, 'cells:', cells.length);

      // Yield again
      setScanStage('Recognizing numbers...');
      await new Promise(r => setTimeout(r, 0));

      // Step 2: Load recognizer if not pre-loaded
      if (!recognizerRef.current) {
        console.log('[camera] loading ONNX model on demand...');
        recognizerRef.current = await loadRecognizer();
      }

      // Step 3: Recognize 16 cells
      const recognizer = recognizerRef.current;
      const values: CellValue[][] = [[], [], [], []];

      for (let i = 0; i < cells.length; i++) {
        const { x, y, w, h, row, col } = cells[i];
        const cell = await recognizeCellFromImageData(recognizer, warped, x, y, w, h);
        console.log(`[camera] cell[${row},${col}] → ${cellLabel(cell)}`);
        values[row].push(cell);
        setProgress((i + 1) / 16);
      }

      console.log('[camera] scan complete');
      setScanResult({
        values,
        sourceImage: imageData,
        gridFound,
        quadCorners,
        warpedImage: warped,
      });
    } catch (err) {
      console.error('[camera] scan failed:', err);
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [scanning, preloadDone]);

  const handleAccept = useCallback(() => {
    if (scanResult) onCapture(scanResult.values);
  }, [scanResult, onCapture]);

  const handleRetry = useCallback(() => {
    setScanResult(null);
  }, []);

  // Preview/confirmation screen
  if (scanResult) {
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
            <div className="scan-preview-image">
              <canvas ref={previewCanvasRef} />
            </div>

            <div className="scan-preview-grid">
              <p className="scan-preview-label">Recognized values:</p>
              <div className="scan-grid">
                {scanResult.values.flat().map((cell, i) => (
                  <div key={i} className="scan-grid-cell">
                    {cellLabel(cell)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="scan-preview-actions">
            <button className="btn-secondary" onClick={handleRetry}>Retry</button>
            <button className="btn-primary" onClick={handleAccept}>Accept</button>
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
          <button onClick={onClose}>Go Back</button>
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
            <div style={{ width: 64 }} />
          </div>

          {!ready && <div className="camera-loading">Starting camera...</div>}
          {scanning && (
            <div className="camera-loading">
              <div className="scan-progress">
                <p>{scanStage}</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
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
