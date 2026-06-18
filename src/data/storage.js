import { USE_SUPABASE, SUPABASE_PHOTOS_BUCKET, SUPABASE_URL } from '../config.js';
import { supabase } from './client.js';

const PUBLIC_PREFIX = USE_SUPABASE
  ? `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_PHOTOS_BUCKET}/`
  : '';

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isManagedPhotoUrl(value) {
  return Boolean(PUBLIC_PREFIX) && typeof value === 'string' && value.startsWith(PUBLIC_PREFIX);
}

function extFromDataUrl(dataUrl) {
  const m = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(dataUrl || '');
  const mime = (m && m[1] ? m[1].toLowerCase() : 'jpeg').replace('svg+xml', 'svg');
  if (mime === 'jpg') return 'jpeg';
  return mime;
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) throw new Error('Imagem invalida para upload.');
  const mimeMatch = /^data:(.*?);base64$/.exec(parts[0]);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bytes = atob(parts[1]);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

function pathFromManagedUrl(url) {
  if (!isManagedPhotoUrl(url)) return null;
  return decodeURIComponent(url.slice(PUBLIC_PREFIX.length));
}

export async function uploadPhotoIfNeeded(entity, id, nextValue, previousValue) {
  const nextFoto = nextValue || '';
  const oldFoto = previousValue || '';

  if (!USE_SUPABASE) return nextFoto;
  if (!nextFoto) {
    if (oldFoto && isManagedPhotoUrl(oldFoto)) await deleteManagedPhoto(oldFoto);
    return '';
  }
  if (!isDataUrl(nextFoto)) return nextFoto;

  const ext = extFromDataUrl(nextFoto);
  const path = `${entity}/${id}-${Date.now()}.${ext}`;
  const blob = dataUrlToBlob(nextFoto);
  const { error } = await supabase.storage
    .from(SUPABASE_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Falha ao enviar foto: ${error.message}`);

  const { data } = supabase.storage.from(SUPABASE_PHOTOS_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl || '';

  if (oldFoto && oldFoto !== publicUrl && isManagedPhotoUrl(oldFoto)) {
    await deleteManagedPhoto(oldFoto);
  }

  return publicUrl;
}

export async function deleteManagedPhoto(url) {
  if (!USE_SUPABASE) return;
  const path = pathFromManagedUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(SUPABASE_PHOTOS_BUCKET).remove([path]);
  if (error) throw new Error(`Falha ao remover foto antiga: ${error.message}`);
}

export function isSupabasePhotoUrl(value) {
  return isManagedPhotoUrl(value);
}
