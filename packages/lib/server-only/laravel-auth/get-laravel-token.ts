import { LogCategory, LogLevel } from '@prisma/client';
import CryptoJS from 'crypto-js';

import { createLog } from '../../utils/createLog';
import { env } from '../../utils/env';

export const generateLaravelToken = async (): Promise<string> => {
  try {
    const encryptionKey = env('NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY');

    if (!encryptionKey) {
      await createLog({
        level: LogLevel.ERROR,
        category: LogCategory.INTEGRATION,
        action: 'LARAVEL_TOKEN_MISSING_KEY',
        message: 'Laravel encryption key is missing',
      });

      throw new Error('Missing Laravel encryption key');
    }

    const key = CryptoJS.enc.Utf8.parse(encryptionKey);
    const iv = CryptoJS.enc.Utf8.parse(encryptionKey);

    const payload = {
      key: encryptionKey,
      timestamp: new Date().toISOString(),
    };

    return CryptoJS.AES.encrypt(JSON.stringify(payload), key, { iv }).toString();
  } catch (error) {
    await createLog({
      level: LogLevel.ERROR,
      category: LogCategory.INTEGRATION,
      action: 'LARAVEL_TOKEN_ENCRYPT_FAILED',
      message: 'Failed to generate Laravel token',
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
};
