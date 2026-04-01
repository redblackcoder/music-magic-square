import { useRef, useEffect, useState, useCallback } from 'react';
import type { CellValue, NoteDuration } from '../types';
import type { ScanResult } from '../imageProcessing';

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

const GHOST_NUMBERS = [
  ['8', '4', '1', '2+1'],
  ['1', '2+1', '8', '4'],
  ['2+1', '1', '4', '8'],
  ['4', '8', '2+1', '1'],
];

export default function Camera({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

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

    setScanning(true);
    setScanStage('Sending to server...');

    try {
      // Capture frame as JPEG
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const sourceImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      setScanStage('Processing...');

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
        sourceImage,
        gridFound: result.gridFound,
        quadCorners: result.quadCorners,
        warpedImage: sourceImage, // placeholder — warped image stays server-side
      });
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [scanning]);

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
