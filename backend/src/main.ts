import { ConfigService } from '@nestjs/config';
import { createApplication } from './application.js';
import { PinoLogger } from './common/foodscan/pino-logger.js';

const app = await createApplication();
const port = app.get(ConfigService).get('PORT') || 4000;
await app.listen(port, '0.0.0.0');
app.get(PinoLogger).log({ event: 'server_started', port });
