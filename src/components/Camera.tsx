import { useRef, useEffect, useState, useCallback } from 'react';
import { captureFrame, recognizeGrid, drawDetectionOverlay } from '../imageProcessing';
import type { NoteType } from '../types';

interface CameraProps {
  onCapture: (notes: NoteType[][]) => void;
  onClose: () => void;
}

export default function Camera({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (err) {
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

  // Draw overlay on canvas
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animId: number;
    function draw() {
      if (!video || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawDetectionOverlay(ctx, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [ready]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const imageData = captureFrame(video);
    const notes = recognizeGrid(imageData);
    onCapture(notes);
  }, [onCapture]);

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
          <canvas ref={canvasRef} className="camera-overlay" />
          <div className="camera-controls">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-capture" onClick={handleCapture} disabled={!ready}>
              <span className="capture-icon" />
            </button>
            <div style={{ width: 64 }} /> {/* spacer for centering */}
          </div>
          {!ready && <div className="camera-loading">Starting camera...</div>}
          <div className="camera-hint">
            Align the 4x4 grid within the guide lines, then tap capture
          </div>
        </>
      )}
    </div>
  );
}
