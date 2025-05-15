import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  // SubscribeMessage, // We will handle messages directly on the client socket for native WebSockets
  // MessageBody,      // for this approach
  // ConnectedSocket,  // for this approach
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws'; // Import from 'ws'
import { Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

// Define a structure for messages you expect from the client and send to the client
interface ChatPayload {
  text: string;
  sender?: string; // 'user' or other client identifier if provided
  timestamp?: string | Date;
  // You could add a 'type' field if you have different kinds of messages
  // type?: 'chatMessage' | 'userTyping' | 'systemInfo';
}

interface ServerMessagePayload {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'server_info';
  originalClientId?: string; // To identify the original user for their own messages
  timestamp: Date;
}

@WebSocketGateway() // Port is usually inherited from HTTP server, CORS not applicable here like for Socket.IO
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server; // This will be a ws.Server instance

  private clients: Map<WebSocket, { id: string }> = new Map(); // Store clients with an ID
  private logger: Logger = new Logger('ChatGateway');
  private static clientCounter = 0; // Simple way to assign unique IDs

  constructor(private readonly aiService: AiService) {}

  handleConnection(client: WebSocket, ...args: any[]) {
    const clientId = `client-${ChatGateway.clientCounter++}`;
    this.clients.set(client, { id: clientId });
    this.logger.log(
      `Client connected: ${clientId} (Total: ${this.clients.size})`,
    );

    // Send a connection acknowledgment message to the client
    const welcomeMessage: ServerMessagePayload = {
      id: `${Date.now()}-welcome`,
      text: `Welcome, ${clientId}! You are connected.`,
      sender: 'server_info',
      timestamp: new Date(),
    };
    client.send(JSON.stringify(welcomeMessage));

    // Handle messages from this specific client
    client.on('message', async (data: Buffer | ArrayBuffer | Buffer[]) => {
      const messageString = data.toString();
      this.logger.log(`Message received from ${clientId}: ${messageString}`);

      try {
        const parsedMessage: ChatPayload = JSON.parse(messageString);

        if (parsedMessage && typeof parsedMessage.text === 'string') {
          // 1. Broadcast the original user message (optional, but good UX)
          const userMessageForBroadcast: ServerMessagePayload = {
            id: `${Date.now()}-${clientId}-msg`,
            text: parsedMessage.text,
            sender: 'user',
            originalClientId: clientId,
            timestamp: new Date(),
          };
          this.broadcast(userMessageForBroadcast);

          // 2. Get AI response
          const aiResponseText = await this.aiService.generateText(
            parsedMessage.text,
          );
          this.logger.log(`AI Response for ${clientId}: ${aiResponseText}`);

          // 3. Broadcast the AI response
          const aiMessageForBroadcast: ServerMessagePayload = {
            id: `${Date.now()}-bot-response`,
            text: aiResponseText,
            sender: 'bot',
            timestamp: new Date(),
          };
          this.broadcast(aiMessageForBroadcast);
        } else {
          this.logger.warn(`Received invalid message format from ${clientId}`);
          client.send(
            JSON.stringify({
              id: `${Date.now()}-error`,
              text: 'Invalid message format. Please send { "text": "your message" }.',
              sender: 'server_info',
              timestamp: new Date(),
            }),
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to parse message or process AI for ${clientId}: ${error.message}`,
          error.stack,
        );
        client.send(
          JSON.stringify({
            id: `${Date.now()}-error`,
            text: 'Error processing your message.',
            sender: 'server_info',
            timestamp: new Date(),
          }),
        );
      }
    });

    client.on('close', (code, reason) => {
      const clientInfo = this.clients.get(client);
      this.clients.delete(client);
      this.logger.log(
        `Client disconnected: ${clientInfo?.id || 'unknown'} (Code: ${code}, Reason: ${reason.toString() || 'N/A'}). Total: ${this.clients.size}`,
      );
    });

    client.on('error', (error) => {
      const clientInfo = this.clients.get(client);
      this.logger.error(
        `Error for client ${clientInfo?.id || 'unknown'}: ${error.message}`,
        error.stack,
      );
      // Consider closing the client connection here if the error is severe
      // this.clients.delete(client);
      // client.close();
    });
  }

  handleDisconnect(client: WebSocket) {
    // This method provided by OnGatewayDisconnect might not be as reliably triggered
    // for cleanup as the 'close' event on the individual client socket with 'ws'.
    // The individual client.on('close', ...) is generally preferred for cleanup.
    const clientInfo = this.clients.get(client);
    this.logger.log(
      `handleDisconnect (less reliable for ws) called for: ${clientInfo?.id || 'unknown'}`,
    );
    if (clientInfo) {
      this.clients.delete(client);
    }
  }

  private broadcast(messagePayload: ServerMessagePayload) {
    const messageString = JSON.stringify(messagePayload);
    this.logger.log(`Broadcasting message: ${messageString}`);
    this.clients.forEach((_value, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }
}
