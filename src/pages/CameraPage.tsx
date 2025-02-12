import React, {useState} from 'react';
import {View, Text, Button, Image, StyleSheet} from 'react-native';
import {
  launchCamera,
  CameraOptions,
  Asset,
  launchImageLibrary,
} from 'react-native-image-picker';
import {CanvasExample} from '../components/CanvasExample';

type ImageQualityResult = {
  tooDark: boolean;
  tooBlurry: boolean;
};

export function CameraScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImageQualityResult | null>(null);

  const handleTakePhoto = async () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: true,
      quality: 1,
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets.length > 0) {
        const asset: Asset = result.assets[0];
        if (asset.uri) {
          setPhotoUri(asset.uri);
          setAnalysis(null);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  // https://medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf
  const evaluateImageQuality = async (
    uri: string,
  ): Promise<ImageQualityResult> => {
    return {
      tooDark: false,
      tooBlurry: false,
    };
  };

  const handleAnalyzePhoto = async () => {
    if (!photoUri) return;
    try {
      const result = await evaluateImageQuality(photoUri);
      setAnalysis(result);
    } catch (err) {
      console.error('Error analyzing photo:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera + OpenCV Example</Text>

      <Button title="Take Photo" onPress={handleTakePhoto} />

      {photoUri && (
        <Image
          source={{uri: photoUri}}
          style={styles.image}
          resizeMode="contain"
        />
      )}

      {photoUri && (
        <Button title="Analyze Photo" onPress={handleAnalyzePhoto} />
      )}

      {analysis && (
        <View style={styles.results}>
          <Text>
            {analysis.tooDark
              ? 'Photo is too dark. '
              : 'Photo brightness is okay. '}
            {analysis.tooBlurry ? 'Photo is blurry!' : 'Photo is sharp enough.'}
          </Text>
        </View>
      )}

      {photoUri && <CanvasExample uri={photoUri} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 16,
  },
  results: {
    marginTop: 16,
  },
});
