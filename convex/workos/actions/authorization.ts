import type { WorkosHonoEnv } from '../../types';
import { env } from '../../env';
import { Context } from 'hono';
import { internal } from '../../_generated/api';

/**
 * Manually sign an actions response for WorkOS using Web Crypto API.
 * See: https://workos.com/docs/actions
 */
async function signActionResponse(
  payload: { timestamp: number; verdict: 'Allow' | 'Deny'; error_message?: string },
  secret: string,
): Promise<{ object: string; payload: typeof payload; signature: string }> {
  const payloadString = JSON.stringify(payload);
  const signatureInput = `${payload.timestamp}.${payloadString}`;

  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signatureInput);

  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    object: 'authentication_action_response',
    payload,
    signature,
  };
}

export async function handleAuthenticationActions(ctx: Context<WorkosHonoEnv>) {
  const workosActionContext = ctx.var.workosActionContext;

  try {
    const timestamp = Date.now();

    let payload: { timestamp: number; verdict: 'Allow' | 'Deny'; error_message?: string };

    if (workosActionContext.object === 'authentication_action_context') {
      // Schedule async user provisioning - fire and forget
      // This pre-creates the user record before the user.created webhook arrives
      // The webhook will update the record with the WorkOS user ID
      // Note: metadata from WorkOS is ignored - metadata is stored locally in Convex only
      const { user } = workosActionContext;

      await ctx.env.scheduler.runAfter(0, internal.users.internal.mutation.upsertFromWorkos, {
        externalId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        updatedAt: Date.now(),
      });

      console.log(`[Authorization] Scheduled upsert for: ${user.email}`);

      payload = {
        timestamp,
        verdict: 'Allow',
      };
    } else {
      payload = {
        timestamp,
        verdict: 'Deny',
        error_message: 'Unsupported action object',
      };
    }

    const response = await signActionResponse(payload, env.WORKOS_ACTION_SECRET);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error occurred', error);
    return new Response('Auth Action Error', { status: 400 });
  }
}
