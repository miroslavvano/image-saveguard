import {CanvasRenderingContext2D, ImageData} from 'react-native-canvas';

let cachedImageData: ImageData | null = null;

async function createImageData(
  canvasCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  if (
    cachedImageData &&
    cachedImageData.width === w &&
    cachedImageData.height === h
  ) {
    // Optionally, you could clear the data here if needed.
    return cachedImageData;
  }
  cachedImageData = await canvasCtx.getImageData(0, 0, w, h);
  return cachedImageData;
}

export function getFloat32Array(
  len: number | ArrayLike<number>,
): Float32Array | number[] {
  if (typeof Float32Array === 'undefined') {
    if (Array.isArray(len) || (len as ArrayLike<number>).length !== undefined) {
      return Array.prototype.slice.call(len);
    }
    return new Array(len as number);
  } else {
    return new Float32Array(len as ArrayLike<number>);
  }
}

function createImageDataFloat32(w: number, h: number) {
  return {width: w, height: h, data: getFloat32Array(w * h * 4)};
}

async function identity(
  pixels: ImageData,
  canvasCtx: CanvasRenderingContext2D,
) {
  const output = await createImageData(canvasCtx, pixels.width, pixels.height);
  const dst = output.data;
  const d = pixels.data;
  for (let i = 0; i < d.length; i++) {
    dst[i] = d[i];
  }
  return output;
}

async function horizontalConvolve(
  canvasCtx: CanvasRenderingContext2D,
  pixels: ImageData,
  weightsVector: Float32Array | number[],
  opaque: boolean,
) {
  const side = weightsVector.length;
  const halfSide = Math.floor(side / 2);

  const src = pixels.data;
  const sw = pixels.width;
  const sh = pixels.height;

  const w = sw;
  const h = sh;
  const output = await createImageData(canvasCtx, w, h);
  const dst = output.data;

  const alphaFac = opaque ? 1 : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * w + x) * 4;
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let cx = 0; cx < side; cx++) {
        const scy = sy;
        const scx = Math.min(sw - 1, Math.max(0, sx + cx - halfSide));
        const srcOff = (scy * sw + scx) * 4;
        const wt = weightsVector[cx];
        r += src[srcOff] * wt;
        g += src[srcOff + 1] * wt;
        b += src[srcOff + 2] * wt;
        a += src[srcOff + 3] * wt;
      }
      dst[dstOff] = r;
      dst[dstOff + 1] = g;
      dst[dstOff + 2] = b;
      dst[dstOff + 3] = a + alphaFac * (255 - a);
    }
  }
  return output;
}

async function verticalConvolveFloat32(
  pixels: ImageData,
  weightsVector: Float32Array | number[],
  opaque: boolean,
) {
  const side = weightsVector.length;
  const halfSide = Math.floor(side / 2);

  const src = pixels.data;
  const sw = pixels.width;
  const sh = pixels.height;

  const w = sw;
  const h = sh;
  const output = createImageDataFloat32(w, h);
  const dst = output.data;

  const alphaFac = opaque ? 1 : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * w + x) * 4;
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let cy = 0; cy < side; cy++) {
        const scy = Math.min(sh - 1, Math.max(0, sy + cy - halfSide));
        const scx = sx;
        const srcOff = (scy * sw + scx) * 4;
        const wt = weightsVector[cy];
        r += src[srcOff] * wt;
        g += src[srcOff + 1] * wt;
        b += src[srcOff + 2] * wt;
        a += src[srcOff + 3] * wt;
      }
      dst[dstOff] = r;
      dst[dstOff + 1] = g;
      dst[dstOff + 2] = b;
      dst[dstOff + 3] = a + alphaFac * (255 - a);
    }
  }
  return output;
}

async function separableConvolve(
  canvasCtx: CanvasRenderingContext2D,
  pixels: ImageData,
  horizWeights: Float32Array | number[],
  vertWeights: Float32Array | number[],
  opaque: boolean,
) {
  const imageData = await verticalConvolveFloat32(pixels, vertWeights, opaque);
  return horizontalConvolve(canvasCtx, imageData, horizWeights, opaque);
}

export async function gaussianBlur(
  pixels: ImageData,
  diameter: number,
  canvasCtx: CanvasRenderingContext2D,
) {
  diameter = Math.abs(diameter);
  if (diameter <= 1) return identity(pixels, canvasCtx);
  const radius = diameter / 2;
  const len = Math.ceil(diameter) + (1 - (Math.ceil(diameter) % 2));
  const weights = getFloat32Array(len);
  const rho = (radius + 0.5) / 3;
  const rhoSq = rho * rho;
  const gaussianFactor = 1 / Math.sqrt(2 * Math.PI * rhoSq);
  const rhoFactor = -1 / (2 * rho * rho);
  let wsum = 0;
  const middle = Math.floor(len / 2);
  for (let i = 0; i < len; i++) {
    const x = i - middle;
    const gx = gaussianFactor * Math.exp(x * x * rhoFactor);
    weights[i] = gx;
    wsum += gx;
  }
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= wsum;
  }

  const convolved = await separableConvolve(
    canvasCtx,
    pixels,
    weights,
    weights,
    false,
  );
  return convolved;
}

export async function luminance(
  canvasCtx: CanvasRenderingContext2D,
  pixels: ImageData,
) {
  const output = await createImageData(canvasCtx, pixels.width, pixels.height);
  const dst = output.data;
  const d = pixels.data;

  //cause ERROR -> Property storage exceeds 196607 properties
  const limit = Math.min(d.length, dst.length);

  for (let i = 0; i < limit; i += 4) {
    if (i + 3 >= limit) {
      break;
    }
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Compute the luminance using the CIE formula.
    const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    dst[i] = dst[i + 1] = dst[i + 2] = v;
    dst[i + 3] = d[i + 3];
  }
  return output;
}

export async function convolve(
  canvasCtx: CanvasRenderingContext2D,
  pixels: ImageData,
  weights: Float32Array | number[],
  opaque: boolean,
) {
  const side = Math.round(Math.sqrt(weights.length));
  const halfSide = Math.floor(side / 2);

  const src = pixels.data;
  const sw = pixels.width;
  const sh = pixels.height;

  const w = sw;
  const h = sh;
  const output = await createImageData(canvasCtx, w, h);
  const dst = output.data;

  const alphaFac = opaque ? 1 : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * w + x) * 4;
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = Math.min(sh - 1, Math.max(0, sy + cy - halfSide));
          const scx = Math.min(sw - 1, Math.max(0, sx + cx - halfSide));
          const srcOff = (scy * sw + scx) * 4;
          const wt = weights[cy * side + cx];
          r += src[srcOff] * wt;
          g += src[srcOff + 1] * wt;
          b += src[srcOff + 2] * wt;
          a += src[srcOff + 3] * wt;
        }
      }
      dst[dstOff] = r;
      dst[dstOff + 1] = g;
      dst[dstOff + 2] = b;
      dst[dstOff + 3] = a + alphaFac * (255 - a);
    }
  }
  return output;
}
