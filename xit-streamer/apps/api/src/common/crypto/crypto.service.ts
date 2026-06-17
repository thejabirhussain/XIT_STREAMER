import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption service for securing OAuth tokens at rest.
 *
 * Storage format: base64(iv):base64(authTag):base64(ciphertext)
 * IV: 16 random bytes per encryption (unique per call)
 * Key: 32 bytes (64 hex chars) from ENCRYPTION_KEY env var
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const hexKey = this.configService.get<string>('encryption.key');
    if (!hexKey || hexKey.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns format: base64(iv):base64(authTag):base64(ciphertext)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a ciphertext string encrypted with encrypt().
   * Expects format: base64(iv):base64(authTag):base64(ciphertext)
   */
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
    }

    const [ivBase64, authTagBase64, ciphertextBase64] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }
}
