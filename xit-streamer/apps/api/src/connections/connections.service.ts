import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * List all platform connections for a user.
   * Excludes encrypted token fields from response.
   */
  async listConnections(userId: string): Promise<Partial<PlatformConnection>[]> {
    const connections = await this.connectionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return connections.map((conn) => ({
      id: conn.id,
      platform: conn.platform,
      accountName: conn.accountName,
      accountId: conn.accountId,
      avatarUrl: conn.avatarUrl,
      connectionStatus: conn.connectionStatus,
      tokenExpiresAt: conn.tokenExpiresAt,
      lastSyncedAt: conn.lastSyncedAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
  }

  /**
   * Get connection detail by ID. Verifies ownership.
   */
  async getConnection(userId: string, connectionId: string): Promise<Partial<PlatformConnection>> {
    const conn = await this.connectionRepo.findOne({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new NotFoundException(`Connection ${connectionId} not found.`);
    }

    return {
      id: conn.id,
      platform: conn.platform,
      accountName: conn.accountName,
      accountId: conn.accountId,
      avatarUrl: conn.avatarUrl,
      connectionStatus: conn.connectionStatus,
      tokenExpiresAt: conn.tokenExpiresAt,
      lastSyncedAt: conn.lastSyncedAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  /**
   * Disconnect a platform by removing the connection record.
   */
  async disconnect(userId: string, connectionId: string): Promise<void> {
    const conn = await this.connectionRepo.findOne({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new NotFoundException(`Connection ${connectionId} not found.`);
    }

    await this.connectionRepo.remove(conn);
    this.logger.log(`Disconnected ${conn.platform} for user ${userId}`);
  }

  /**
   * Get the decrypted access token for a connection.
   * Used internally by chat aggregators and stream services.
   */
  async getDecryptedAccessToken(connectionId: string): Promise<string> {
    const conn = await this.connectionRepo.findOne({ where: { id: connectionId } });
    if (!conn) {
      throw new NotFoundException(`Connection ${connectionId} not found.`);
    }
    return this.cryptoService.decrypt(conn.encryptedAccessToken);
  }

  /**
   * Get all connections for a specific platform for a user.
   */
  async getConnectionsByPlatform(userId: string, platform: string): Promise<PlatformConnection[]> {
    return this.connectionRepo.find({
      where: { userId, platform: platform as PlatformConnection['platform'] },
    });
  }
}
