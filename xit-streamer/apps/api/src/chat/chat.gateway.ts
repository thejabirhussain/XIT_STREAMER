import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a stream room to receive real-time updates.
   */
  @SubscribeMessage('stream:join')
  handleJoinStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): void {
    const room = `stream:${data.sessionId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  /**
   * Client leaves a stream room.
   */
  @SubscribeMessage('stream:leave')
  handleLeaveStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): void {
    const room = `stream:${data.sessionId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  /**
   * Broadcast a new chat message to all clients in the stream room.
   */
  emitChatMessage(sessionId: string, message: Record<string, unknown>): void {
    this.server.to(`stream:${sessionId}`).emit('chat:message', message);
  }

  /**
   * Broadcast a stream status change event.
   */
  emitStatusChanged(sessionId: string, event: {
    sessionId: string;
    previousStatus: string;
    newStatus: string;
    timestamp: string;
    reason?: string;
  }): void {
    this.server.to(`stream:${sessionId}`).emit('stream:status_changed', event);
  }

  /**
   * Broadcast a health snapshot update.
   */
  emitHealth(sessionId: string, snapshot: Record<string, unknown>): void {
    this.server.to(`stream:${sessionId}`).emit('stream:health', snapshot);
  }

  /**
   * Broadcast a connection expired event.
   */
  emitConnectionExpired(userId: string, event: Record<string, unknown>): void {
    this.server.to(`user:${userId}`).emit('connection:expired', event);
  }

  emitOverlayState(sessionId: string, overlays: unknown[]): void {
    this.server.to(`stream:${sessionId}`).emit('overlay:state', { overlays });
  }
}
