const PROD_URL = 'https://music-magic-square.vercel.app';
const DEV_URL = 'https://music-magic-square-git-dev-redblackcoders-projects.vercel.app';

const isDev = import.meta.env.VITE_APP_ENV === 'dev';
const APP_URL = isDev ? DEV_URL : PROD_URL;

/**
 * Pre-generated QR code for PROD_URL (error correction level H).
 */
function QRCodeProd({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 37 37"
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <path fill="#ffffff" d="M0 0h37v37H0z" />
      <path
        stroke="#1a1a2e"
        d="M4 4.5h7m2 0h2m3 0h1m1 0h1m2 0h2m1 0h7M4 5.5h1m5 0h1m2 0h3m3 0h1m4 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m1 0h1m1 0h1m4 0h1m6 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h3m4 0h3m2 0h1m1 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m2 0h2m2 0h1m1 0h3m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h3m1 0h5m1 0h1m1 0h1m1 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h1m1 0h2m1 0h1m1 0h1m3 0h1M4 12.5h1m1 0h5m2 0h3m2 0h2m1 0h1m2 0h1m1 0h5M4 13.5h3m2 0h1m1 0h1m4 0h1m3 0h1m2 0h6m3 0h1M4 14.5h2m1 0h2m1 0h1m5 0h1m2 0h1m1 0h2m1 0h2m1 0h2M7 15.5h2m5 0h2m2 0h1m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1M4 16.5h3m1 0h4m3 0h1m5 0h1m1 0h1m1 0h1m3 0h2M4 17.5h1m1 0h2m3 0h2m2 0h4m3 0h2m1 0h4m3 0h1M4 18.5h2m3 0h3m1 0h7m4 0h1m1 0h2m1 0h2M4 19.5h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h2m1 0h2m2 0h1m4 0h1m2 0h1M4 20.5h2m2 0h1m1 0h2m1 0h4m1 0h1m2 0h2m4 0h1m1 0h2M4 21.5h1m1 0h3m2 0h1m1 0h1m2 0h1m3 0h9m1 0h1m1 0h1M4 22.5h1m4 0h2m1 0h5m2 0h3m2 0h1m1 0h3m1 0h1M4 23.5h1m1 0h1m1 0h2m2 0h2m4 0h3m1 0h1m4 0h2m2 0h1M4 24.5h1m1 0h2m1 0h2m1 0h1m2 0h1m3 0h1m1 0h1m1 0h6m1 0h3M12 25.5h1m3 0h3m1 0h1m3 0h1m3 0h5M4 26.5h7m3 0h1m1 0h6m1 0h2m1 0h1m1 0h3M4 27.5h1m5 0h1m1 0h2m1 0h1m1 0h1m4 0h3m3 0h1M4 28.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h2m1 0h1m2 0h5m1 0h1M4 29.5h1m1 0h3m1 0h1m1 0h4m1 0h1m2 0h1m1 0h3m2 0h1m1 0h4M4 30.5h1m1 0h3m1 0h1m1 0h2m5 0h1m3 0h1m1 0h7M4 31.5h1m5 0h1m3 0h3m1 0h1m5 0h2m1 0h3m1 0h1M4 32.5h7m1 0h2m3 0h1m1 0h3m1 0h1m3 0h1m2 0h1"
      />
    </svg>
  );
}

/**
 * Pre-generated QR code for DEV_URL (error correction level H).
 */
function QRCodeDev({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 57 57"
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <path fill="#ffffff" d="M0 0h57v57H0z" />
      <path
        stroke="#1a1a2e"
        d="M4 4.5h7m2 0h1m4 0h1m2 0h2m1 0h1m4 0h1m2 0h1m4 0h3m5 0h1m2 0h1m2 0h7M4 5.5h1m5 0h1m2 0h3m3 0h3m4 0h2m1 0h5m5 0h3m2 0h3m2 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m2 0h1m2 0h1m2 0h2m4 0h2m2 0h3m2 0h2m2 0h4m1 0h2m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m2 0h10m2 0h3m1 0h2m1 0h2m2 0h2m1 0h2m1 0h1m2 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h3m7 0h2m4 0h7m1 0h1m1 0h2m5 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m4 0h2m3 0h2m1 0h1m4 0h1m2 0h2m1 0h1m3 0h1m1 0h2m2 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h2m1 0h1m2 0h1m2 0h2m2 0h2m2 0h2m3 0h1m2 0h2M6 12.5h2m2 0h6m1 0h1m3 0h2m2 0h7m1 0h5m2 0h5m2 0h2m1 0h1M5 13.5h4m6 0h2m2 0h1m3 0h2m1 0h1m2 0h3m1 0h2m5 0h1m3 0h5M4 14.5h1m1 0h1m3 0h2m6 0h1m2 0h2m1 0h2m1 0h1m2 0h1m1 0h2m2 0h1m3 0h1m2 0h3m2 0h2M6 15.5h1m2 0h1m2 0h4m3 0h1m1 0h1m4 0h2m2 0h2m1 0h1m2 0h2m1 0h1m1 0h1m2 0h8M4 16.5h2m3 0h3m1 0h1m2 0h3m3 0h1m1 0h1m3 0h1m1 0h1m2 0h2m1 0h3m2 0h1m2 0h1M6 17.5h1m1 0h2m2 0h10m2 0h2m2 0h5m1 0h1m1 0h1m1 0h2m2 0h2m4 0h2M4 18.5h1m3 0h1m1 0h3m1 0h1m3 0h4m1 0h4m1 0h1m1 0h3m6 0h4m2 0h4M5 19.5h4m4 0h2m6 0h4m2 0h2m5 0h1m1 0h1m5 0h3m2 0h2m2 0h1M4 20.5h2m4 0h2m1 0h5m5 0h2m1 0h5m2 0h4m2 0h2m3 0h5M6 21.5h3m3 0h1m3 0h2m1 0h1m1 0h1m3 0h1m2 0h2m5 0h1m2 0h1m1 0h1m1 0h2m1 0h1M4 22.5h1m3 0h1m1 0h2m1 0h1m1 0h3m3 0h2m3 0h1m1 0h1m3 0h2m1 0h2m2 0h1m2 0h2M4 23.5h4m3 0h4m1 0h1m1 0h1m1 0h1m3 0h1m1 0h5m3 0h3m2 0h3m1 0h1m1 0h1M5 24.5h1m1 0h1m1 0h2m1 0h1m2 0h1m2 0h2m3 0h3m2 0h1m2 0h2m1 0h1m5 0h1m2 0h2M5 25.5h1m6 0h1m1 0h1m2 0h1m2 0h2m1 0h2m2 0h2m1 0h3m1 0h1m3 0h2m4 0h1M4 26.5h2m2 0h5m2 0h6m2 0h3m2 0h6m1 0h3m1 0h1m1 0h7M5 27.5h2m1 0h1m3 0h2m2 0h1m1 0h1m1 0h1m1 0h4m1 0h6m2 0h1m1 0h2m1 0h1m3 0h4M4 28.5h2m1 0h2m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m2 0h1m2 0h13m1 0h1m1 0h5M5 29.5h1m1 0h2m5 0h1m3 0h2m2 0h2m1 0h1m1 0h1m2 0h2m1 0h2m3 0h1m2 0h2m1 0h1m3 0h2M4 30.5h2m1 0h6m1 0h10m2 0h6m2 0h1m1 0h1m2 0h11M4 31.5h3m1 0h1m2 0h1m2 0h5m2 0h1m1 0h2m1 0h1m5 0h1m2 0h1m1 0h1m2 0h2m2 0h1M5 32.5h4m1 0h3m1 0h1m1 0h3m1 0h5m2 0h3m1 0h3m2 0h1m1 0h1m2 0h2m1 0h7m3 0h1M7 33.5h1m8 0h2m2 0h3m1 0h1m1 0h1m3 0h4m1 0h3m4 0h1m1 0h1m5 0h1M8 34.5h1m1 0h1m1 0h1m1 0h2m4 0h1m1 0h2m1 0h3m1 0h1m4 0h1m1 0h3m1 0h7m2 0h3M4 35.5h2m1 0h1m5 0h6m2 0h3m3 0h2m1 0h2m1 0h4m2 0h5m2 0h2M5 36.5h1m3 0h2m2 0h5m3 0h2m1 0h1m1 0h1m3 0h5m1 0h1m2 0h1m2 0h2m3 0h1M4 37.5h2m6 0h1m1 0h1m1 0h1m1 0h2m1 0h1m3 0h2m1 0h1m3 0h2m2 0h2m1 0h1M4 38.5h1m1 0h2m2 0h4m1 0h4m1 0h2m1 0h1m1 0h1m1 0h2m2 0h2m1 0h1m1 0h2m8 0h1M5 39.5h1m8 0h2m4 0h6m1 0h3m3 0h1m1 0h1m1 0h2m1 0h2m2 0h3M5 40.5h1m1 0h4m6 0h2m2 0h1m4 0h4m2 0h4m1 0h8m1 0h1m1 0h1M4 41.5h2m3 0h1m2 0h1m1 0h1m2 0h1m2 0h1m1 0h2m2 0h2m3 0h3m2 0h1m1 0h6M5 42.5h1m3 0h2m1 0h1m5 0h1m3 0h5m2 0h1m2 0h1m1 0h1m1 0h2m1 0h1m2 0h1M5 43.5h3m4 0h1m1 0h2m5 0h1m1 0h2m1 0h1m2 0h1m1 0h1m1 0h2m1 0h2m7 0h3M4 44.5h3m3 0h1m2 0h1m1 0h3m2 0h1m1 0h1m2 0h5m1 0h1m1 0h2m1 0h1m6 0h5m1 0h1M12 45.5h1m3 0h4m1 0h1m2 0h4m1 0h1m3 0h3m1 0h1m2 0h3m3 0h3m2 0h1M4 46.5h7m1 0h2m2 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h2m1 0h1m7 0h1m1 0h2m3 0h1M4 47.5h1m5 0h1m3 0h4m4 0h1m2 0h2m2 0h2m1 0h1m4 0h4m1 0h1m3 0h2m3 0h1M4 48.5h1m1 0h3m1 0h1m2 0h1m2 0h1m1 0h4m1 0h1m1 0h6m1 0h1m3 0h3m1 0h1m1 0h6M4 49.5h1m1 0h3m1 0h1m1 0h1m3 0h1m1 0h1m2 0h1m2 0h2m1 0h1m1 0h2m7 0h1m3 0h2m2 0h1M4 50.5h1m1 0h3m1 0h1m1 0h2m2 0h1m5 0h1m2 0h3m1 0h1m1 0h2m3 0h2m2 0h2M4 51.5h1m5 0h1m2 0h2m2 0h2m1 0h1m2 0h3m1 0h1m1 0h8m1 0h3m1 0h1m1 0h2M4 52.5h7m1 0h5m3 0h1m2 0h3m1 0h2m7 0h3m1 0h1m2 0h4"
      />
    </svg>
  );
}

function BeamedEighthNotes({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size}>
      <circle cx="32" cy="32" r="32" fill="#1a1a2e" />
      <ellipse cx="18" cy="46" rx="7" ry="5" fill="#e94560" transform="rotate(-15 18 46)" />
      <ellipse cx="46" cy="42" rx="7" ry="5" fill="#e94560" transform="rotate(-15 46 42)" />
      <rect x="23.5" y="14" width="2.5" height="33" fill="#e94560" />
      <rect x="51.5" y="10" width="2.5" height="33" fill="#e94560" />
      <polygon points="23.5,14 54,10 54,16 23.5,20" fill="#e94560" />
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
          {isDev ? <QRCodeDev size={240} /> : <QRCodeProd size={240} />}
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
