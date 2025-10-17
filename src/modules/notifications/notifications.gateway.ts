// notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  emitToUser(userId: string, payload: any) {
    this.server.to(`user_${userId}`).emit('notification', payload);
  }

  handleConnection(socket: any) {
    const userId = socket.handshake.query.userId;
    socket.join(`user_${userId}`);
  }
}