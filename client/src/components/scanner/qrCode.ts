import jsQR from 'jsqr';

/** Widest frame (in pixels) handed to the QR decoder; smaller frames decode faster on phones. */
const MAX_QR_FRAME_WIDTH = 640;

/**
 * Turns the text inside a QR code into the code the app should look up.
 * GS1 QR codes on medicine boxes carry the product's GTIN after "01" (for example
 * "(01)00312345678906(17)261231..."); the GTIN is returned so it matches the UPC in the file.
 * Any other QR text is returned trimmed.
 */
export function codeFromQrText(raw: string): string {
  const text = raw
    .replace(/^\][A-Za-z]\d/, '') // symbology prefix such as "]Q3"
    .split(String.fromCharCode(29))
    .join('')
    .trim();
  const gs1 = /^\(?01\)?(\d{14})/.exec(text);
  if (gs1?.[1]) return gs1[1];
  return text;
}

/** Reads a QR code from the current frame of a playing video, or returns null. */
export function readQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const scale = Math.min(1, MAX_QR_FRAME_WIDTH / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const result = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
  if (!result?.data) return null;
  const code = codeFromQrText(result.data);
  return code === '' ? null : code;
}
