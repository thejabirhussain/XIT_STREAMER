import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard for internal API routes (Media Engine → API).
 * Validates the X-Internal-Secret header matches MEDIA_ENGINE_SECRET.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-internal-secret'] as string;
    const expectedSecret = this.configService.get<string>('media.engineSecret');

    if (!secret || !expectedSecret || secret !== expectedSecret) {
      throw new ForbiddenException(
        'Invalid or missing X-Internal-Secret header. This endpoint is for internal service communication only.',
      );
    }

    return true;
  }
}
