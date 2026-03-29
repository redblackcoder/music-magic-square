declare module 'qrcode.react' {
  import { ComponentType, SVGProps } from 'react';

  interface ImageSettings {
    src: string;
    x?: number;
    y?: number;
    height: number;
    width: number;
    excavate?: boolean;
    opacity?: number;
    crossOrigin?: string;
  }

  interface QRCodeProps extends SVGProps<SVGSVGElement> {
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    bgColor?: string;
    fgColor?: string;
    includeMargin?: boolean;
    marginSize?: number;
    imageSettings?: ImageSettings;
    title?: string;
  }

  export const QRCodeSVG: ComponentType<QRCodeProps>;
  export const QRCodeCanvas: ComponentType<QRCodeProps>;
}
