import { v } from 'convex/values';
import { protectedMutation } from '../functions';
import { languageValidator, Metadata } from '../schema';

export const completeOnboarding = protectedMutation({
  args: {
    preferredLocale: v.optional(languageValidator),
  },
  async handler(ctx, args) {
    // Merge with existing metadata, set onboardingComplete and preferredLocale
    const updatedMetadata: Metadata = {
      ...ctx.user.metadata,
      onboardingComplete: true,
      ...(args.preferredLocale && { preferredLocale: args.preferredLocale }),
    };

    await ctx.db.patch(ctx.user._id, {
      metadata: updatedMetadata,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
