import { LogLevel } from '@prisma/client';
import { DateTime } from 'luxon';
import type { Browser, BrowserContext, Page } from 'playwright';

import {
  NEXT_PRIVATE_INTERNAL_WEBAPP_URL,
  NEXT_PUBLIC_WEBAPP_URL,
  USE_INTERNAL_URL_BROWSERLESS,
} from '../../constants/app';
import { type SupportedLanguageCodes, isValidLanguageCode } from '../../constants/i18n';
import { createLog } from '../../utils/createLog';
import { env } from '../../utils/env';
import { encryptSecondaryData } from '../crypto/encrypt';

export type GetCertificatePdfOptions = {
  documentId: number;
  // eslint-disable-next-line @typescript-eslint/ban-types
  language?: SupportedLanguageCodes | (string & {});
};

type CertificateGenerationStage =
  | 'initialization'
  | 'browser_connection'
  | 'context_creation'
  | 'page_creation'
  | 'cookie_configuration'
  | 'page_navigation'
  | 'page_reload'
  | 'content_ready'
  | 'pdf_generation';

const BROWSER_CONNECTION_TIMEOUT_MS = 15_000;
const CONTEXT_CREATION_TIMEOUT_MS = 10_000;
const PAGE_CREATION_TIMEOUT_MS = 10_000;
const PDF_GENERATION_TIMEOUT_MS = 30_000;
const CLEANUP_TIMEOUT_MS = 5_000;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const getCertificatePdf = async ({ documentId, language }: GetCertificatePdfOptions) => {
  const startedAt = Date.now();
  const { chromium } = await import('playwright');

  let browser: Browser | undefined;
  let browserContext: BrowserContext | undefined;
  let page: Page | undefined;

  let currentStage: CertificateGenerationStage = 'initialization';
  let browserMode: 'browserless' | 'local' = 'local';

  try {
    const encryptedId = encryptSecondaryData({
      data: documentId.toString(),
      expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
    });

    const browserlessUrl = env('NEXT_PRIVATE_BROWSERLESS_URL');

    browserMode = browserlessUrl ? 'browserless' : 'local';
    currentStage = 'browser_connection';

    if (browserlessUrl) {
      browser = await chromium.connectOverCDP(browserlessUrl, {
        timeout: BROWSER_CONNECTION_TIMEOUT_MS,
      });
    } else {
      browser = await withTimeout(
        chromium.launch({
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        }),
        BROWSER_CONNECTION_TIMEOUT_MS,
        `Local Chromium launch timed out for document ${documentId}`,
      );
    }

    currentStage = 'context_creation';

    browserContext = await withTimeout(
      browser.newContext(),
      CONTEXT_CREATION_TIMEOUT_MS,
      `Browser context creation timed out for document ${documentId}`,
    );

    currentStage = 'page_creation';

    page = await withTimeout(
      browserContext.newPage(),
      PAGE_CREATION_TIMEOUT_MS,
      `Browser page creation timed out for document ${documentId}`,
    );

    const lang = isValidLanguageCode(language) ? language : 'en';

    const webappUrl = USE_INTERNAL_URL_BROWSERLESS()
      ? NEXT_PUBLIC_WEBAPP_URL()
      : NEXT_PRIVATE_INTERNAL_WEBAPP_URL();

    currentStage = 'cookie_configuration';

    await page.context().addCookies([
      {
        name: 'lang',
        value: lang,
        url: webappUrl,
      },
    ]);

    currentStage = 'page_navigation';

    await page.goto(`${webappUrl}/__htmltopdf/certificate?d=${encryptedId}`, {
      waitUntil: 'networkidle',
      timeout: 10_000,
    });

    currentStage = 'page_reload';

    await page.reload({
      waitUntil: 'networkidle',
      timeout: 10_000,
    });

    currentStage = 'content_ready';

    await page.waitForSelector('h1', {
      state: 'visible',
      timeout: 10_000,
    });

    currentStage = 'pdf_generation';

    const result = await withTimeout(
      page.pdf({
        format: 'A4',
        printBackground: true,
      }),
      PDF_GENERATION_TIMEOUT_MS,
      `PDF generation timed out for document ${documentId}`,
    );

    return result;
  } catch (error) {
    await createLog({
      level: LogLevel.ERROR,
      action: 'CERTIFICATE_PDF_GENERATION_ERROR',
      message: 'Certificate PDF generation failed',
      data: {
        documentId,
        browserMode,
        failedStage: currentStage,
        totalDurationMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : null,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    throw error;
  } finally {
    if (browserContext) {
      try {
        await withTimeout(
          browserContext.close(),
          CLEANUP_TIMEOUT_MS,
          `Browser context cleanup timed out for document ${documentId}`,
        );
      } catch (error) {
        await createLog({
          level: LogLevel.ERROR,
          action: 'CERTIFICATE_BROWSER_CONTEXT_CLOSE_ERROR',
          message: 'Failed to close certificate browser context',
          data: {
            documentId,
            browserMode,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    if (browser?.isConnected()) {
      try {
        await withTimeout(
          browser.close(),
          CLEANUP_TIMEOUT_MS,
          `Browser cleanup timed out for document ${documentId}`,
        );
      } catch (error) {
        await createLog({
          level: LogLevel.ERROR,
          action: 'CERTIFICATE_BROWSER_CLOSE_ERROR',
          message: 'Failed to close certificate browser',
          data: {
            documentId,
            browserMode,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
};
