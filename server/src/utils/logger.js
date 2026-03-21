import pino from 'pino';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const transport = pino.transport({
    targets: [
        {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
            level: 'debug',
        },
        {
            target: 'pino/file',
            options: { destination: join(__dirname, '../../logs/backend.log') },
            level: 'info',
        },
    ],
});

export const logger = pino(transport);
