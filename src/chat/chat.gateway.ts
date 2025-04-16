import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io'; // Import Server and Socket types
import { Logger } from '@nestjs/common'; // Import Logger
import { AiService } from 'src/ai/ai.service';

// Define the WebSocket port and CORS settings
// Make sure the origin matches your React frontend URL (default Vite is 5173)
@WebSocketGateway({
  cors: {
    origin: '*', // Allow connections from your React app
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Inject the Socket.IO server instance
  @WebSocketServer()
  server: Server;

  // Use NestJS Logger for cleaner console output
  private logger: Logger = new Logger('ChatGateway');

  // Inject the AiService
  constructor(private readonly aiService: AiService) {}

  // Handle client connection
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // Handle client disconnection
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Handle incoming 'sendMessage' events
  @SubscribeMessage('sendMessage')
  async handleMessage(
    // Make the handler async
    @MessageBody() payload: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // Return Promise<void> for async
    this.logger.log(`Message received from ${client.id}: ${payload}`);

    // 1. Broadcast the original user message immediately (optional, good UX)
    this.server.emit('newMessage', `You (${client.id}): ${payload}`);

    // 2. Get AI response
    try {
      // Indicate AI is thinking (optional)
      client.emit('aiTyping', { isTyping: true }); // Send only to the sender

      const aiResponse = await this.aiService.generateText(payload);
      this.logger.log(`AI Response for ${client.id}: ${aiResponse}`);

      // Stop typing indicator
      client.emit('aiTyping', { isTyping: false });

      // 3. Broadcast the AI response
      // Option A: Send back only to the original sender
      // client.emit('newMessage', `Bot: ${aiResponse}`);

      // Option B: Send to everyone (like a public bot)
      this.server.emit('newMessage', `Bot: ${aiResponse}`);
    } catch (error) {
      client.emit('aiTyping', { isTyping: false }); // Ensure typing indicator stops on error
      this.logger.error(
        `Failed to get AI response for ${client.id}: ${error.message}`,
      );
      client.emit('newMessage', `Bot: Sorry, I had trouble processing that.`); // Send error message back to sender
    }
  }
}
