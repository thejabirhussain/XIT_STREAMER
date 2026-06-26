import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { LivestreamSession } from './livestream-session.entity';

@Entity('chat_messages')
@Unique(['sessionId', 'platform', 'externalId'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_id' })
  externalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'display_name' })
  displayName: string;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'platform_ts' })
  platformTs: Date;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @Column({ type: 'boolean', default: false })
  highlighted: boolean;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @ManyToOne(() => LivestreamSession, (session) => session.chatMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: LivestreamSession;
}
