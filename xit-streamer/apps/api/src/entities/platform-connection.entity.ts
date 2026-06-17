import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export type Platform = 'youtube' | 'facebook' | 'instagram';
export type ConnectionStatus = 'connected' | 'expired' | 'revoked' | 'error';

@Entity('platform_connections')
@Unique(['userId', 'platform', 'accountId'])
export class PlatformConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  platform: Platform;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'account_name' })
  accountName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'account_id' })
  accountId: string;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl: string;

  @Column({ type: 'text', name: 'encrypted_access_token' })
  encryptedAccessToken: string;

  @Column({ type: 'text', nullable: true, name: 'encrypted_refresh_token' })
  encryptedRefreshToken: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'token_expires_at' })
  tokenExpiresAt: Date;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'connected',
    name: 'connection_status',
  })
  connectionStatus: ConnectionStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_synced_at' })
  lastSyncedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.connections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
