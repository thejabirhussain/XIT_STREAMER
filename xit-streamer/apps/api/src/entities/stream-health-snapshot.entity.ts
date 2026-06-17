import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LivestreamSession } from './livestream-session.entity';

@Entity('stream_health_snapshots')
export class StreamHealthSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'integer', nullable: true, name: 'bitrate_kbps' })
  bitrateKbps: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  fps: number;

  @Column({ type: 'integer', nullable: true, name: 'dropped_frames' })
  droppedFrames: number;

  @Column({ type: 'boolean', nullable: true, name: 'rtmp_connected' })
  rtmpConnected: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'ffmpeg_running' })
  ffmpegRunning: boolean;

  @Column({ type: 'integer', nullable: true, name: 'uptime_seconds' })
  uptimeSeconds: number;

  @CreateDateColumn({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @ManyToOne(() => LivestreamSession, (session) => session.healthSnapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: LivestreamSession;
}
