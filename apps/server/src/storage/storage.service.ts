import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StoredFile {
  storageKey: string;
  url: string;
}

/**
 * Armazenamento de arquivos com driver configurável.
 *  - STORAGE_DRIVER=local  → grava em STORAGE_LOCAL_DIR e serve via /api/files
 *  - STORAGE_DRIVER=s3     → usa um bucket S3-compatível (AWS/MinIO)
 *
 * O driver S3 só é carregado se @aws-sdk/client-s3 estiver instalado (dep
 * opcional); caso contrário, instruímos a configuração em vez de quebrar o boot.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  private readonly localDir = resolve(process.env.STORAGE_LOCAL_DIR ?? './uploads');
  private readonly maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;

  private readonly allowedMime = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/ogg',
    'application/pdf',
  ]);

  validate(mimeType: string, sizeBytes: number) {
    if (!this.allowedMime.has(mimeType)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${mimeType}`);
    }
    if (sizeBytes > this.maxBytes) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${Math.round(this.maxBytes / 1024 / 1024)} MB.`,
      );
    }
  }

  async save(buffer: Buffer, mimeType: string, originalName: string): Promise<StoredFile> {
    this.validate(mimeType, buffer.byteLength);
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const key = `${randomUUID()}.${ext}`;

    if (this.driver === 's3') {
      return this.saveS3(key, buffer, mimeType);
    }
    return this.saveLocal(key, buffer);
  }

  private async saveLocal(key: string, buffer: Buffer): Promise<StoredFile> {
    await fs.mkdir(this.localDir, { recursive: true });
    await fs.writeFile(join(this.localDir, key), buffer);
    return { storageKey: key, url: `/api/files/${key}` };
  }

  async readLocal(key: string): Promise<Buffer> {
    // impede path traversal: só aceita o nome de arquivo plano
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      throw new BadRequestException('Chave inválida.');
    }
    return fs.readFile(join(this.localDir, key));
  }

  private async saveS3(key: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    let S3Client: any, PutObjectCommand: any;
    try {
      // @ts-ignore — dependência OPCIONAL: instalada só quando STORAGE_DRIVER=s3
      ({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'));
    } catch {
      throw new BadRequestException(
        'Driver S3 selecionado mas @aws-sdk/client-s3 não está instalado. ' +
          'Rode `npm i @aws-sdk/client-s3 -w @tabletop/server` e configure as variáveis S3_*.',
      );
    }
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new BadRequestException('S3_BUCKET não configurado.');

    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
    const base = process.env.S3_ENDPOINT
      ? `${process.env.S3_ENDPOINT}/${bucket}`
      : `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com`;
    return { storageKey: key, url: `${base}/${key}` };
  }
}
