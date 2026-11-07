import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { ImageMediaType } from './ai';

export type PickedPhoto = { uri: string; base64: string; mediaType: ImageMediaType };

async function toPicked(res: ImagePicker.ImagePickerResult): Promise<PickedPhoto | null> {
  if (res.canceled || !res.assets[0]?.base64) return null;
  const a = res.assets[0];
  const mediaType: ImageMediaType = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return { uri: a.uri, base64: a.base64!, mediaType };
}

/** Opens the camera (or the library when `fromLibrary`) and returns a downscaled JPEG as base64. */
export async function pickPhoto(fromLibrary = false): Promise<PickedPhoto | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    allowsEditing: false,
    exif: false,
  };
  if (fromLibrary) {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) {
      Alert.alert('写真へのアクセスが許可されていません');
      return null;
    }
    return toPicked(await ImagePicker.launchImageLibraryAsync(opts));
  }
  const p = await ImagePicker.requestCameraPermissionsAsync();
  if (!p.granted) {
    Alert.alert('カメラの使用が許可されていません');
    return null;
  }
  return toPicked(await ImagePicker.launchCameraAsync(opts));
}

/**
 * Copies a picker result (usually a temp/cache URI) into the app's document
 * directory so the thumbnail survives OS cache cleanup. Returns the new URI,
 * or the original one if the copy fails (e.g. on web).
 */
export async function persistPhoto(uri: string): Promise<string> {
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'photos');
    dir.create({ idempotent: true, intermediates: true });
    const ext = uri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn('photo persist failed', e);
    return uri;
  }
}
