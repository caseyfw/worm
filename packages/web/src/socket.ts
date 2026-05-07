import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@worm/shared';

export type WormSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): WormSocket {
  const socket: WormSocket = io();
  return socket;
}
