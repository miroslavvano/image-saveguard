import {ImageData} from 'react-native-canvas';
import {ColorConversionCodes, OpenCV} from 'react-native-fast-opencv';

// Computes the variance of the Laplacian of the image
export function calculateLaplacianVariance(
  imageData: number[],
  width: number,
  height: number,
) {
  const laplacianValues = [];
  // Loop over the pixels except the border pixels.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      // Convert the center pixel to grayscale.
      const center = Math.round(
        (imageData[idx] + imageData[idx + 1] + imageData[idx + 2]) / 3,
      );

      // Get the surrounding pixels (top, bottom, left, right)
      const topIdx = ((y - 1) * width + x) * 4;
      const bottomIdx = ((y + 1) * width + x) * 4;
      const leftIdx = (y * width + (x - 1)) * 4;
      const rightIdx = (y * width + (x + 1)) * 4;

      const top = Math.round(
        (imageData[topIdx] + imageData[topIdx + 1] + imageData[topIdx + 2]) / 3,
      );
      const bottom = Math.round(
        (imageData[bottomIdx] +
          imageData[bottomIdx + 1] +
          imageData[bottomIdx + 2]) /
          3,
      );

      const left = Math.round(
        (imageData[leftIdx] + imageData[leftIdx + 1] + imageData[leftIdx + 2]) /
          3,
      );
      const right = Math.round(
        (imageData[rightIdx] +
          imageData[rightIdx + 1] +
          imageData[rightIdx + 2]) /
          3,
      );
      // Apply the Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
      // Taking the absolute value so that the result is positive.
      const laplacian = Math.abs(4 * center - top - bottom - left - right);
      laplacianValues.push(laplacian);
    }
  }

  // Calculate mean of Laplacian values.
  const mean = Math.round(
    laplacianValues.reduce((acc, val) => {
      if (typeof val === 'number' && val > 0) {
        return acc + val;
      }
      return acc;
    }, 0) / laplacianValues.length,
  );

  // Calculate variance.
  const variance = Math.round(
    laplacianValues.reduce((acc, val) => {
      if (typeof val === 'number' && val > 0) {
        return acc + Math.pow(val - mean, 2);
      }
      return acc;
    }, 0) / laplacianValues.length,
  );
  return variance;
}
