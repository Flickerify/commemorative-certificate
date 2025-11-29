import { v } from 'convex/values';
import { protectedAction } from '../functions';
import { languageValidator, Metadata } from '../schema';
import { internal } from '../_generated/api';

export const completeOnboarding = protectedAction({
  args: {
    preferredLocale: v.optional(languageValidator),
  },
  async handler(ctx, args) {
    // Build metadata
    const metadata: Metadata = {
      onboardingComplete: 'true',
    };

    if (args.preferredLocale) {
      metadata.preferredLocale = args.preferredLocale;
    }

    // 1. Update Convex immediately (fast, no round-trip)
    await ctx.runMutation(internal.users.internal.mutation.updateMetadata, {
      userId: ctx.user._id,
      metadata,
    });

    // 2. Sync to WorkOS (webhook will confirm but user doesn't have to wait)
    await ctx.runAction(internal.workos.internal.action.updateUserMetadata, {
      workosUserId: ctx.user.externalId,
      metadata,
    });

    return { success: true };
  },
});
