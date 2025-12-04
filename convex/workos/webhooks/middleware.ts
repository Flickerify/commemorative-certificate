import type { Context, Next } from 'hono';
import type { WorkosHonoEnv } from '../../types';

import { createMiddleware } from 'hono/factory';
import { internal } from '../../_generated/api';

/**
 * Middleware to verify a WorkOS webhook event.
 * @param secret - The signing secret of the webhook event.
 * @returns The middleware function.
 */
export const workosWebhookMiddleware = (secret: string) =>
  createMiddleware<WorkosHonoEnv>(async (ctx: Context<WorkosHonoEnv>, next: Next) => {
    const request = ctx.req;
    const bodyText = await request.text();
    const sigHeader = String(request.header('workos-signature'));

    try {
      const result = await ctx.env.runAction(internal.workos.internal.action.verifyWebhook, {
        payload: bodyText,
        signature: sigHeader,
        secret,
      });
      ctx.set('workosEvent', result);
      await next();
    } catch (error) {
      console.error('Error verifying webhook event', error);
      return new Response('Signature Verification Error Occured', {
        status: 400,
      });
    }
  });

export const workosActionMiddleware = (secret: string) =>
  createMiddleware<WorkosHonoEnv>(async (ctx: Context<WorkosHonoEnv>, next: Next) => {
    const request = ctx.req;
    const bodyText = await request.text();
    const sigHeader = String(request.header('workos-signature'));

    try {
      const result = await ctx.env.runAction(internal.workos.internal.action.verifyAction, {
        payload: bodyText,
        signature: sigHeader,
        secret,
      });
      ctx.set('workosActionContext', result);
      await next();
    } catch (error) {
      console.error('Error verifying action', error);
      return new Response('Signature Verification Error Occured', {
        status: 400,
      });
    }
  });
