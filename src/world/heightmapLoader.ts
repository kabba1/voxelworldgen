export type HeightmapData = {
  heights: Uint16Array;
  width: number;
  depth: number;
  sourceWidth: number;
  sourceHeight: number;
  loadedFrom: string;
  usedFallback: boolean;
};

export type HeightmapLoadOptions = {
  targetWidth: number;
  targetDepth: number;
  maxTerrainHeight: number;
  urls?: string[];
};

const DEFAULT_HEIGHTMAP_URLS = ["/heightmap.png", "/public/heightmap.png"];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const brightnessToHeight = (brightness: number, maxTerrainHeight: number) => {
  const scaled = Math.round(clamp01(brightness) * maxTerrainHeight);
  return Math.max(0, Math.min(maxTerrainHeight, scaled));
};

const imageBitmapFromUrl = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Heightmap request failed: ${response.status}`);
  }

  const blob = await response.blob();
  return createImageBitmap(blob);
};

const heightsFromBitmap = (
  bitmap: ImageBitmap,
  targetWidth: number,
  targetDepth: number,
  maxTerrainHeight: number
) => {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetDepth;

  const context = canvas.getContext("2d", {
    alpha: false,
    colorSpace: "srgb",
    willReadFrequently: true
  });
  if (!context) throw new Error("Could not create heightmap canvas context.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, targetWidth, targetDepth);

  const pixels = context.getImageData(0, 0, targetWidth, targetDepth).data;
  const heights = new Uint16Array(targetWidth * targetDepth);

  for (let index = 0, pixel = 0; index < heights.length; index += 1, pixel += 4) {
    const brightness = (pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722) / 255;
    heights[index] = brightnessToHeight(brightness, maxTerrainHeight);
  }

  return heights;
};

const fallbackHeightAt = (x: number, z: number, width: number, depth: number, maxTerrainHeight: number) => {
  const nx = (x / Math.max(1, width - 1)) * 2 - 1;
  const nz = (z / Math.max(1, depth - 1)) * 2 - 1;
  const hill = Math.exp(-((nx + 0.2) * (nx + 0.2) + (nz - 0.1) * (nz - 0.1)) * 3.5);
  const ridge = Math.sin(nx * 7 + nz * 3) * 0.08;
  const brightness = clamp01(0.18 + hill * 0.56 + ridge);
  return brightnessToHeight(brightness, maxTerrainHeight);
};

const fallbackHeightmap = (targetWidth: number, targetDepth: number, maxTerrainHeight: number): HeightmapData => {
  const heights = new Uint16Array(targetWidth * targetDepth);

  for (let z = 0; z < targetDepth; z += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      heights[z * targetWidth + x] = fallbackHeightAt(x, z, targetWidth, targetDepth, maxTerrainHeight);
    }
  }

  return {
    heights,
    width: targetWidth,
    depth: targetDepth,
    sourceWidth: 32,
    sourceHeight: 32,
    loadedFrom: "generated fallback",
    usedFallback: true
  };
};

export const loadHeightmapData = async ({
  targetWidth,
  targetDepth,
  maxTerrainHeight,
  urls = DEFAULT_HEIGHTMAP_URLS
}: HeightmapLoadOptions): Promise<HeightmapData> => {
  for (const url of urls) {
    try {
      const bitmap = await imageBitmapFromUrl(url);
      const sourceWidth = bitmap.width;
      const sourceHeight = bitmap.height;
      const heights = heightsFromBitmap(bitmap, targetWidth, targetDepth, maxTerrainHeight);
      bitmap.close();

      return {
        heights,
        width: targetWidth,
        depth: targetDepth,
        sourceWidth,
        sourceHeight,
        loadedFrom: url,
        usedFallback: false
      };
    } catch {
      // Try the next known Vite/static path before falling back.
    }
  }

  return fallbackHeightmap(targetWidth, targetDepth, maxTerrainHeight);
};
