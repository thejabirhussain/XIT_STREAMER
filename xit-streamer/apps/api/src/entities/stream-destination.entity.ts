import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LivestreamSession } from './livestream-session.entity';
import { PlatformConnection } from './platform-connection.entity';

export type DestinationStatus = 'pending' | 'active' | 'error' | 'completed';

@Entity('stream_destinations')
export class StreamDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', nullable: true, name: 'connection_id' })
  connectionId: string | null;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column({ type: 'text', nullable: true, name: 'rtmp_url' })
  rtmpUrl: string | null;

  @Column({ type: 'text', nullable: true, name: 'stream_key' })
  streamKey: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status: DestinationStatus;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => LivestreamSession, (session) => session.destinations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: LivestreamSession;

  @ManyToOne(() => PlatformConnection, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connection_id' })
  connection: PlatformConnection;
}
