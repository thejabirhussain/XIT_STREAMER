import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { StreamDestination } from './stream-destination.entity';
import { ChatMessage } from './chat-message.entity';
import { StreamHealthSnapshot } from './stream-health-snapshot.entity';

export type IngestType = 'rtmp' | 'webrtc';
export type StreamStatus =
  | 'created'
  | 'scheduled'
  | 'broadcast_starting'
  | 'live'
  | 'ending'
  | 'completed'
  | 'error';
export type RecordingStatus = 'disabled' | 'recording' | 'processing' | 'ready' | 'error';

@Entity('livestream_sessions')
export class LivestreamSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'rtmp',
    name: 'ingest_type',
  })
  ingestType: IngestType;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'created',
  })
  status: StreamStatus;

  @Column({ type: 'varchar', length: 255, unique: true, name: 'stream_key' })
  streamKey: string;

  @Column({ type: 'text', nullable: true, name: 'rtmp_ingest_url' })
  rtmpIngestUrl: string;

  // ─── Recording Architecture Placeholders ─────────────────
  @Column({ type: 'boolean', default: false, name: 'recording_enabled' })
  recordingEnabled: boolean;

  @Column({ type: 'text', nullable: true, name: 'recording_url' })
  recordingUrl: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'disabled',
    name: 'recording_status',
  })
  recordingStatus: RecordingStatus;

  // ─── Scheduling ──────────────────────────────────────────
  @Column({ type: 'timestamptz', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'ended_at' })
  endedAt: Date;

  // ─── Platform Broadcast IDs ──────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'youtube_broadcast_id' })
  youtubeBroadcastId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'youtube_stream_id' })
  youtubeStreamId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'youtube_live_chat_id' })
  youtubeLiveChatId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'facebook_live_id' })
  facebookLiveId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'instagram_live_id' })
  instagramLiveId: string;

  // ─── Error Tracking ──────────────────────────────────────
  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => StreamDestination, (dest) => dest.session)
  destinations: StreamDestination[];

  @OneToMany(() => ChatMessage, (msg) => msg.session)
  chatMessages: ChatMessage[];

  @OneToMany(() => StreamHealthSnapshot, (snap) => snap.session)
  healthSnapshots: StreamHealthSnapshot[];
}
