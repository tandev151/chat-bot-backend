// src/ai/ai.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class AiService implements OnModuleInit {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly logger = new Logger(AiService.name);

  onModuleInit() {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      this.logger.error(
        'GOOGLE_API_KEY is not defined in environment variables.',
      );
      // Depending on your error handling strategy, you might want to throw an error
      // throw new Error('Missing GOOGLE_API_KEY');
      return; // Or simply return if you handle the lack of model elsewhere
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Choose the model you want to use
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.logger.log('Gemini AI Service Initialized');
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.model) {
      this.logger.error('Gemini model not initialized. Cannot generate text.');
      return 'Sorry, the AI service is not available right now.';
    }
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      this.logger.log(`Generated response for prompt: "${prompt}"`);
      return text;
    } catch (error) {
      const { message, stack } = error;
      this.logger.error(`Error generating text: ${message}`, stack);
      return 'Sorry, I encountered an error trying to respond.';
    }
  }

  // Optional: Add a method for chat history later if needed
  // async generateChatResponse(history: Content[], newMessage: string): Promise<string> {
  //   // ... implementation using model.startChat() ...
  // }
}
