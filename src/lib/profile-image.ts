/** Maximum file size accepted from the file picker (before client-side processing). */
export const PROFILE_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Longest edge after resize — profile avatars are shown small on screen. */
export const PROFILE_IMAGE_MAX_LONG_EDGE = 1024;

/** WebP quality (0–1). JPEG fallback uses a slightly higher value. */
export const PROFILE_IMAGE_WEBP_QUALITY = 0.82;
export const PROFILE_IMAGE_JPEG_QUALITY = 0.85;

export const PROFILE_IMAGE_TOO_LARGE_MESSAGE =
  "画像は10MB以下のものを選択してください";

export const PROFILE_IMAGE_PROCESS_FAILED_MESSAGE =
  "画像を処理できませんでした。別の画像をお試しください";

export function isProfileImageWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= PROFILE_IMAGE_MAX_INPUT_BYTES;
}

export function scaleProfileImageDimensions(
  width: number,
  height: number,
  maxLongEdge: number = PROFILE_IMAGE_MAX_LONG_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function canvasToPreferredBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  const webp = await canvasToBlob(
    canvas,
    "image/webp",
    PROFILE_IMAGE_WEBP_QUALITY,
  );
  if (webp && webp.size > 0) {
    return webp;
  }

  const jpeg = await canvasToBlob(
    canvas,
    "image/jpeg",
    PROFILE_IMAGE_JPEG_QUALITY,
  );
  if (jpeg && jpeg.size > 0) {
    return jpeg;
  }

  throw new Error(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
}

/**
 * Resize, compress, and return a lightweight data URL for localStorage.
 * EXIF orientation is applied via createImageBitmap when supported.
 */
export async function processProfileImage(file: File): Promise<string> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    throw new Error(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
  }

  try {
    const { width, height } = scaleProfileImageDimensions(
      bitmap.width,
      bitmap.height,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToPreferredBlob(canvas);
    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) {
    throw new Error(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}
