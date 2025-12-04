import { ConvexError, v } from 'convex/values';
import { publicMutation } from '../functions';

/**
 * Provision a user immediately after sign-up (before webhook arrives).
 * Called from client-side after authentication to ensure user exists.
 * Requires authentication but doesn't require user to exist yet.
 * Uses upsert pattern - safe to call multiple times.
 */
export const provision = publicMutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Authentication required');
    }

    // Check if user already exists
    const existing = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', identity.subject))
      .first();

    if (existing) {
      return existing._id;
    }
    console.log('Provisioning user', identity);
    // Create user with minimal data - webhook will fill in the rest
    const userId = await ctx.db.insert('users', {
      externalId: identity.subject,
      email: identity.email ?? '',
      firstName: identity.givenName ?? null,
      lastName: identity.familyName ?? null,
      emailVerified: identity.emailVerified ?? false,
      profilePictureUrl: identity.pictureUrl ?? null,
      role: 'user',
      metadata: {
        onboardingComplete: 'false',
        preferredLocale: identity.language ?? 'en',
      },
      updatedAt: Date.now(),
    });

    return userId;
  },
});
