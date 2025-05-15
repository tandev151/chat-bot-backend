import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws'; // Import WsAdapter
import { config } from 'dotenv';

async function bootstrap() {
  config();
  const port = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(port, () => {
    console.log(`Listening at poirt:` + port);
  });
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
