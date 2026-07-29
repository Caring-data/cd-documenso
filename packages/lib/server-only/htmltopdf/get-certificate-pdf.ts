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

export const getCertificatePdf = async ({ documentId, language }: GetCertificatePdfOptions) => {
  const startedAt = Date.now();
  const { chromium } = await import('playwright');

  let browser: Browser | undefined;
  let browserContext: BrowserContext | undefined;
  let page: Page | undefined;

  const logStage = async (
    action: string,
    stage: string,
    stageStartedAt: number,
    data: Record<string, unknown> = {},
  ) => {
    await createLog({
      level: LogLevel.INFO,
      action,
      message: `Certificate generation stage: ${stage}`,
      data: {
        documentId,
        stage,
        stageDurationMs: Date.now() - stageStartedAt,
        totalDurationMs: Date.now() - startedAt,
        ...data,
      },
    });
  };

  const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  try {
    const encryptedId = encryptSecondaryData({
      data: documentId.toString(),
      expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
    });

    const browserlessUrl = env('NEXT_PRIVATE_BROWSERLESS_URL');
    const browserMode = browserlessUrl ? 'browserless' : 'local';

    let stageStartedAt = Date.now();

    await logStage('CERTIFICATE_BROWSER_CONNECTION_START', 'browser_connection', stageStartedAt, {
      browserMode,
    });

    if (browserlessUrl) {
      browser = await chromium.connectOverCDP(browserlessUrl, {
        timeout: 15_000,
      });
    } else {
      browser = await withTimeout(
        chromium.launch({
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        }),
        15_000,
        `Local Chromium launch timed out for document ${documentId}`,
      );
    }

    await logStage('CERTIFICATE_BROWSER_CONNECTION_SUCCESS', 'browser_connection', stageStartedAt, {
      browserMode,
    });

    stageStartedAt = Date.now();

    browserContext = await browser.newContext();
    page = await browserContext.newPage();

    await logStage('CERTIFICATE_PAGE_CREATED', 'page_creation', stageStartedAt);

    const lang = isValidLanguageCode(language) ? language : 'en';

    const webappUrl = USE_INTERNAL_URL_BROWSERLESS()
      ? NEXT_PUBLIC_WEBAPP_URL()
      : NEXT_PRIVATE_INTERNAL_WEBAPP_URL();

    await page.context().addCookies([
      {
        name: 'lang',
        value: lang,
        url: webappUrl,
      },
    ]);

    stageStartedAt = Date.now();

    await logStage('CERTIFICATE_PAGE_NAVIGATION_START', 'page_navigation', stageStartedAt);

    await page.goto(`${webappUrl}/__htmltopdf/certificate?d=${encryptedId}`, {
      waitUntil: 'networkidle',
      timeout: 10_000,
    });

    await logStage('CERTIFICATE_PAGE_NAVIGATION_SUCCESS', 'page_navigation', stageStartedAt);

    stageStartedAt = Date.now();

    await page.reload({
      waitUntil: 'networkidle',
      timeout: 10_000,
    });

    await logStage('CERTIFICATE_PAGE_RELOAD_SUCCESS', 'page_reload', stageStartedAt);

    stageStartedAt = Date.now();

    await page.waitForSelector('h1', {
      state: 'visible',
      timeout: 10_000,
    });

    await logStage('CERTIFICATE_CONTENT_READY', 'content_ready', stageStartedAt);

    stageStartedAt = Date.now();

    await logStage('CERTIFICATE_PDF_GENERATION_START', 'pdf_generation', stageStartedAt);

    const result = await withTimeout(
      page.pdf({
        format: 'A4',
        printBackground: true,
      }),
      30_000,
      `PDF generation timed out for document ${documentId}`,
    );

    await logStage('CERTIFICATE_PDF_GENERATION_SUCCESS', 'pdf_generation', stageStartedAt, {
      pdfSize: result.length,
    });

    return result;
  } catch (error) {
    await createLog({
      level: LogLevel.ERROR,
      action: 'CERTIFICATE_PDF_GENERATION_ERROR',
      message: 'Certificate PDF generation failed',
      data: {
        documentId,
        totalDurationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    throw error;
  } finally {
    const CLEANUP_TIMEOUT_MS = 5_000;

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
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    if (browser) {
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
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
};
