'use node';

import { v } from 'convex/values';

import { WorkOS } from '@workos-inc/node';
import { internalAction } from '../../functions';
import { metadataValidator } from '../../schema';

/**
 * Verify a WorkOS webhook event.
 */
export const verifyWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  handler: async (_ctx, { payload, signature, secret }) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    return await workos.webhooks.constructEvent({
      payload: JSON.parse(payload),
      sigHeader: signature,
      secret,
    });
  },
});

/**
 * Verify a WorkOS action.
 */
export const verifyAction = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  handler: async (_ctx, { payload, signature, secret }) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    return await workos.actions.constructAction({
      payload: JSON.parse(payload),
      sigHeader: signature,
      secret,
    });
  },
});

/**
 * Update user metadata in WorkOS.
 * WorkOS stores all metadata as strings.
 * This will trigger a user.updated webhook which syncs the metadata back to Convex.
 */
export const updateUserMetadata = internalAction({
  args: {
    workosUserId: v.string(),
    metadata: v.optional(metadataValidator),
  },
  handler: async (_ctx, { workosUserId, metadata }) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    await workos.userManagement.updateUser({
      userId: workosUserId,
      metadata,
    });

    return { success: true };
  },
});

/**
 * Revoke all sessions for a user to force logout.
 * Called when a user is deleted to invalidate all their active sessions.
 */
export const revokeAllUserSessions = internalAction({
  args: {
    workosUserId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    revokedCount: v.number(),
  }),
  handler: async (_ctx, { workosUserId }) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    let revokedCount = 0;

    try {
      // List all sessions for the user
      const sessionsResponse = await workos.userManagement.listSessions(workosUserId);

      // Revoke each session
      for (const session of sessionsResponse.data) {
        try {
          await workos.userManagement.revokeSession({ sessionId: session.id });
          revokedCount++;
          console.log(`[WorkOS] Revoked session ${session.id} for user ${workosUserId}`);
        } catch (err) {
          console.error(`[WorkOS] Failed to revoke session ${session.id}:`, err);
        }
      }

      console.log(`[WorkOS] Revoked ${revokedCount} session(s) for user ${workosUserId}`);
      return { success: true, revokedCount };
    } catch (err) {
      console.error(`[WorkOS] Failed to list/revoke sessions for user ${workosUserId}:`, err);
      // Return success anyway since user deletion should proceed
      return { success: false, revokedCount };
    }
  },
});
