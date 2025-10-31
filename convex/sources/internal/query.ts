import { v } from 'convex/values';
import { internalQuery } from '../../functions';

/**
 * Find source by hash (for import deduplication)
 */
export const findByHash = internalQuery({
  args: {
    hash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('sources'),
      url: v.string(),
    }),
  ),
  async handler(ctx, args) {
    const source = await ctx.db
      .query('sources')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first();

    if (!source) {
      return null;
    }

    return {
      _id: source._id,
      url: source.url,
    };
  },
});
