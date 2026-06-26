import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LivestreamSession } from './livestream-session.entity';
import { User } from './user.entity';

export type OverlayType =
  | 'product'
  | 'flash_sale'
  | 'qr_code'
  | 'text'
  | 'image'
  | 'website'
  | 'cta'
  | 'announcement_banner'
  | 'coupon_banner'
  | 'limited_stock'
  | 'brand_logo'
  | 'comment_highlight';

export type OverlayAnimation =
  | 'none'
  | 'fade'
  | 'slide_left'
  | 'slide_right'
  | 'slide_bottom'
  | 'zoom'
  | 'bounce'
  | 'pulse';

@Entity('overlays')
export class Overlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: OverlayType;

  @Column({ type: 'varchar', length: 255, default: 'Overlay' })
  name: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ type: 'float', default: 10 })
  x: number;

  @Column({ type: 'float', default: 10 })
  y: number;

  @Column({ type: 'float', default: 30 })
  width: number;

  @Column({ type: 'float', default: 20 })
  height: number;

  @Column({ type: 'int', default: 1, name: 'z_index' })
  zIndex: number;

  @Column({ type: 'float', default: 0 })
  rotation: number;

  @Column({ type: 'float', default: 1 })
  opacity: number;

  @Column({ type: 'boolean', default: true })
  visible: boolean;

  @Column({ type: 'varchar', length: 50, default: 'none' })
  animation: OverlayAnimation;

  @Column({ type: 'jsonb', default: {}, name: 'style_overrides' })
  styleOverrides: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => LivestreamSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: LivestreamSession;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
