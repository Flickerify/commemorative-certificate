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
