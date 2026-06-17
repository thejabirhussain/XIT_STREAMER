import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class StreamKeyService {
  /**
   * Generate a cryptographically random stream key.
   * Format: xit_live_{32 hex chars}
   */
  generate(): string {
    const random = randomBytes(16).toString('hex');
    return `xit_live_${random}`;
  }
}
