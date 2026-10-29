import { API_BASE, getAccessToken, authApi, setAccessToken } from './api.js';

export interface UploadedAsset {
  id: string;
  url: string; // ex.: /api/files/<key> — prefixar com API_BASE para carregar
  kind: string;
  fileName: string;
}

// Deriva um nome amigável a partir do arquivo: "orc_guerreiro.png" -> "Orc Guerreiro".
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, ''); // tira extensão
  const words = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// URL absoluta para carregar um asset servido pelo backend (driver local).
export function assetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url; // S3 já vem absoluto
  return `${API_BASE}${url}`;
}

// Upload multipart. NÃO usa o helper api() porque este força JSON; aqui o
// browser precisa montar o boundary do multipart sozinho.
export async function uploadAsset(
  campaignId: string,
  file: File,
  retry = true,
): Promise<UploadedAsset> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/assets`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
  });

  if (res.status === 401 && retry) {
    // tenta refresh uma vez
    try {
      const data = await authApi.refresh();
      setAccessToken(data.accessToken);
      return uploadAsset(campaignId, file, false);
    } catch {
      /* cai no erro abaixo */
    }
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Falha no upload (${res.status})`);
  }
  return body as UploadedAsset;
}
