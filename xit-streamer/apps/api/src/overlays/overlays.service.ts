import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Overlay } from '../entities/overlay.entity';
import { CreateOverlayDto } from './dto/create-overlay.dto';
import { UpdateOverlayDto } from './dto/update-overlay.dto';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class OverlaysService {
  constructor(
    @InjectRepository(Overlay)
    private readonly repo: Repository<Overlay>,
    private readonly gateway: ChatGateway,
  ) {}

  async list(userId: string, sessionId: string): Promise<Overlay[]> {
    return this.repo.find({
      where: { userId, sessionId },
      order: { zIndex: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, sessionId: string, dto: CreateOverlayDto): Promise<Overlay> {
    const maxZ = await this.repo
      .createQueryBuilder('o')
      .select('MAX(o.zIndex)', 'max')
      .where('o.sessionId = :sessionId', { sessionId })
      .getRawOne<{ max: number }>();

    const overlay = this.repo.create({
      ...dto,
      userId,
      sessionId,
      zIndex: dto.zIndex ?? ((maxZ?.max ?? 0) + 1),
      config: dto.config ?? {},
      styleOverrides: dto.styleOverrides ?? {},
      visible: dto.visible ?? true,
    });

    const saved = await this.repo.save(overlay);
    await this.broadcast(sessionId, userId);
    return saved;
  }

  async update(userId: string, sessionId: string, id: string, dto: UpdateOverlayDto): Promise<Overlay> {
    const overlay = await this.findOwned(userId, sessionId, id);
    Object.assign(overlay, dto);
    const saved = await this.repo.save(overlay);
    await this.broadcast(sessionId, userId);
    return saved;
  }

  async remove(userId: string, sessionId: string, id: string): Promise<void> {
    const overlay = await this.findOwned(userId, sessionId, id);
    await this.repo.remove(overlay);
    await this.broadcast(sessionId, userId);
  }

  async toggleVisibility(userId: string, sessionId: string, id: string): Promise<Overlay> {
    const overlay = await this.findOwned(userId, sessionId, id);
    overlay.visible = !overlay.visible;
    const saved = await this.repo.save(overlay);
    await this.broadcast(sessionId, userId);
    return saved;
  }

  async reorderZIndex(userId: string, sessionId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.repo.update({ id: orderedIds[i], userId, sessionId }, { zIndex: i + 1 });
    }
    await this.broadcast(sessionId, userId);
  }

  private async findOwned(userId: string, sessionId: string, id: string): Promise<Overlay> {
    const overlay = await this.repo.findOne({ where: { id, sessionId } });
    if (!overlay) throw new NotFoundException('Overlay not found');
    if (overlay.userId !== userId) throw new ForbiddenException();
    return overlay;
  }

  private async broadcast(sessionId: string, userId: string): Promise<void> {
    const overlays = await this.list(userId, sessionId);
    this.gateway.emitOverlayState(sessionId, overlays);
  }
}
