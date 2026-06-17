import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const url = request?.url;
    if (url && url.includes('/api/internal/')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If the response already has the envelope format, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If the data includes a meta property, extract it
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
          };
        }

        // Wrap raw data in standard envelope
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
