import React, {useState, useCallback, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Canvas, {Image as CanvasImage, ImageData} from 'react-native-canvas';
import {calculateLaplacianVariance} from '../utils/blur';
import {measureBlur} from '../utils/measureBlur';

const TOO_DARK_THRESHOLD = 50;
const TOO_LIGHT_THRESHOLD = 200;
const TOO_BLURRY_THRESHOLD = 100;

async function isTooDarkOrLight(
  imageData: Promise<ImageData>,
  darkThreshold = TOO_DARK_THRESHOLD,
  lightThreshold = TOO_LIGHT_THRESHOLD,
): Promise<{isTooDark: boolean; isTooLight: boolean}> {
  let total = 0;
  const {data} = await imageData;

  const dataArray = Object.values(data);

  for (let i = 0; i < dataArray.length; i += 4) {
    const r = dataArray[i];
    const g = dataArray[i + 1];
    const b = dataArray[i + 2];
    const brightness = Math.round((r + g + b) / 3);
    total += brightness;
  }

  const pixelCount = Math.round(dataArray.length / 4);
  const avgBrightness = Math.round(total / pixelCount);
  const isTooDark = avgBrightness < darkThreshold;
  const isTooLight = avgBrightness > lightThreshold;

  return {isTooDark, isTooLight};
}

export const CanvasExample = ({uri}: {uri: string}) => {
  const [result, setResult] = useState<{
    isTooDark: boolean;
    isTooLight: boolean;
  } | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [blur, setBlur] = useState<boolean | null>(null);
  const [vari, setVari] = useState<number | null>(null);

  const [measured, setMeasured] = useState<{
    width: number;
    height: number;
    num_edges: number;
    avg_edge_width: number;
    avg_edge_width_perc: number;
  } | null>(null);

  // 1. Fetch the image and convert it to Base64
  useEffect(() => {
    const fetchImageAsBase64 = async () => {
      setIsLoadingImage(true);
      setIsLoading(true);
      setBlur(null);
      setImageBase64(null);
      setResult(null);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = () => {
          setImageBase64(reader.result as string);
        };

        reader.readAsDataURL(blob);
      } catch (error) {
        console.warn('Failed to load image', error);
      }
    };

    if (uri) {
      fetchImageAsBase64();
    }
  }, [uri]);

  // 2. When the canvas is ready and we have our base64, draw
  const handleCanvas = useCallback(
    async (canvas: Canvas | null) => {
      if (!canvas || !imageBase64) return;

      const ctx = canvas.getContext('2d');
      canvas.width = 300;
      canvas.height = 300;

      const canvasImage = new CanvasImage(canvas);
      canvasImage.src = imageBase64;

      canvasImage.addEventListener('load', async () => {
        ctx.drawImage(canvasImage, 0, 0, 300, 300);
        setIsLoadingImage(false);
        const imageData = ctx.getImageData(0, 0, 300, 300);

        const result = await isTooDarkOrLight(imageData, 50);

        try {
          const data = await imageData;
          const variance = calculateLaplacianVariance(
            Object.values(data.data),
            300,
            300,
          );

          const isBlurry = variance < TOO_BLURRY_THRESHOLD;
          setBlur(isBlurry);
          setVari(variance);

          const measured = await measureBlur(ctx, {
            width: data.width,
            height: data.height,
            data: new Uint8ClampedArray(Object.values(data.data)),
          });
          setMeasured(measured);
        } catch (error) {
          console.error(error);
        }

        setResult(result);
        setIsLoading(false);
      });
    },
    [imageBase64],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Canvas Darkness Check</Text>

      {(isLoading || isLoadingImage) && (
        <Text>
          {isLoadingImage ? 'Drawing image...' : 'Processing image...'}
        </Text>
      )}

      {result !== null && !isLoading && (
        <Text style={styles.result}>
          {result?.isTooDark
            ? 'The image is too dark.'
            : result?.isTooLight
            ? 'The image is too light'
            : 'The image brightness is acceptable.'}
        </Text>
      )}

      {measured !== null && !isLoading && (
        <View>
          <Text>
            {measured.num_edges} edges detected with an average width of{' '}
          </Text>
          <Text> {measured.avg_edge_width} avg edge width </Text>
          <Text>{measured.avg_edge_width_perc} avg edge width perc</Text>
          <Text>
            {measured?.width}x{measured?.height} image
          </Text>
        </View>
      )}

      {blur !== null && !isLoading && (
        <Text>
          {blur ? 'Image is too blurry' : 'Image is NOT blurry'}: {vari}
        </Text>
      )}

      <Canvas ref={handleCanvas} style={styles.canvas} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  canvas: {
    width: 300,
    height: 300,
  },
  result: {
    marginTop: 16,
    fontSize: 16,
  },
});
