import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /api/health
   * Basic liveness probe.
   */
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'xit-streamer-api',
    };
  }

  /**
   * GET /api/health/ready
   * Readiness probe — checks database connectivity.
   */
  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'not_ready',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
