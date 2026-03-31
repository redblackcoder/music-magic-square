import { useRef, useEffect, useState, useCallback } from 'react';
import { captureFrame, type ScanResult } from '../imageProcessing';
import type { CellValue, NoteDuration } from '../types';

interface CameraProps {
  onCapture: (values: CellValue[][]) => void;
  onClose: () => void;
}

/** Map duration back to the hand-written number for display */
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

const GHOST_NUMBERS = [
  ['8', '4', '1', '2+1'],
  ['1', '2+1', '8', '4'],
  ['2+1', '1', '4', '8'],
  ['4', '8', '2+1', '1'],
];

export default function Camera({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [workerReady, setWorkerReady] = useState(false);

  // Create worker on mount — it pre-loads OpenCV + ONNX in the background
  useEffect(() => {
    console.log('[camera] creating scan worker...');
    const worker = new Worker(
      new URL('../scan.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          console.log('[camera] worker ready (OpenCV + ONNX pre-loaded)');
          setWorkerReady(true);
          break;
        case 'progress':
          setProgress(msg.pct);
          break;
        case 'result':
          console.log('[camera] scan complete — gridFound:', msg.gridFound);
          console.log('[camera] recognized values:', JSON.stringify(msg.values.map((row: CellValue[]) =>
            row.map(v => v.kind === 'single' ? v.dur : `${v.first}+${v.second}`)
          )));
          setScanResult({
            values: msg.values,
            gridFound: msg.gridFound,
            quadCorners: msg.quadCorners,
            warpedImage: msg.warpedImageData,
            sourceImage: msg.sourceImageData,
          });
          setScanning(false);
          break;
        case 'error':
          console.error('[camera] worker error:', msg.message);
          setError(`Recognition failed: ${msg.message}`);
          setScanning(false);
          break;
      }
    };

    worker.onerror = (e) => {
      console.error('[camera] worker error event:', e);
      setError('Scanner failed to initialize. Please try again.');
      setScanning(false);
    };

    return () => {
      console.log('[camera] terminating worker');
      worker.terminate();
      workerRef.current = null;
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

    // Draw detected quadrilateral
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

    // Label corners
    const labels = ['TL', 'TR', 'BR', 'BL'];
    const fontSize = Math.max(14, sourceImage.width / 50);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = gridFound ? '#00ff00' : '#ff6600';
    for (let i = 0; i < 4; i++) {
      ctx.fillText(labels[i], quadCorners[i][0] + 8, quadCorners[i][1] - 8);
    }
  }, [scanResult]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const worker = workerRef.current;
    if (!video || !worker || scanning) return;

    console.log('[camera] capture button pressed');
    console.log('[camera] video dimensions:', video.videoWidth, '×', video.videoHeight);
    console.log('[camera] worker pre-loaded:', workerReady);
    setScanning(true);
    setProgress(0);

    const imageData = captureFrame(video);
    console.log('[camera] frame captured:', imageData.width, '×', imageData.height);

    worker.postMessage({ type: 'scan', imageData });
  }, [scanning, workerReady]);

  const handleAccept = useCallback(() => {
    if (scanResult) {
      onCapture(scanResult.values);
    }
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
            {/* Captured image with quad overlay */}
            <div className="scan-preview-image">
              <canvas ref={previewCanvasRef} />
            </div>

            {/* Recognized values grid */}
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

          {/* Pure CSS guide overlay — always visible */}
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
                <p>{workerReady ? 'Scanning numbers...' : 'Loading scanner...'}</p>
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
