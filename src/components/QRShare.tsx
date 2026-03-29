import { QRCodeSVG } from 'qrcode.react';

const APP_URL = 'https://music-magic-square.vercel.app';

/** Beamed eighth notes SVG for the QR code center */
function BeamedEighthNotes({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="32" fill="#1a1a2e" />
      {/* Left note head */}
      <ellipse cx="18" cy="46" rx="7" ry="5" fill="#e94560" transform="rotate(-15 18 46)" />
      {/* Right note head */}
      <ellipse cx="46" cy="42" rx="7" ry="5" fill="#e94560" transform="rotate(-15 46 42)" />
      {/* Left stem */}
      <rect x="23.5" y="14" width="2.5" height="33" fill="#e94560" />
      {/* Right stem */}
      <rect x="51.5" y="10" width="2.5" height="33" fill="#e94560" />
      {/* Beam top */}
      <polygon points="23.5,14 54,10 54,16 23.5,20" fill="#e94560" />
      {/* Beam bottom */}
      <polygon points="23.5,22 54,18 54,24 23.5,28" fill="#e94560" />
    </svg>
  );
}

interface QRShareProps {
  visible: boolean;
  onClose: () => void;
}

export default function QRShare({ visible, onClose }: QRShareProps) {
  if (!visible) return null;

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <h2>Share this app</h2>
        <p className="qr-subtitle">Scan to open on your phone</p>
        <div className="qr-code-wrapper">
          <QRCodeSVG
            value={APP_URL}
            size={240}
            level="H"
            bgColor="#ffffff"
            fgColor="#1a1a2e"
            imageSettings={{
              src: '',
              x: undefined,
              y: undefined,
              height: 48,
              width: 48,
              excavate: true,
            }}
          />
          {/* Custom SVG overlay in the center (since imageSettings.src doesn't support inline SVG) */}
          <div className="qr-center-icon">
            <BeamedEighthNotes size={44} />
          </div>
        </div>
        <p className="qr-url">{APP_URL}</p>
        <button className="btn-secondary qr-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
