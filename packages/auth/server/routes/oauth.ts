import { Hono } from 'hono';

import type { HonoAuthContext } from '../types/context';

export const oauthRoute = new Hono<HonoAuthContext>();
