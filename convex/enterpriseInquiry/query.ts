import { v } from 'convex/values';
import { protectedAdminQuery } from '../functions';
import { paginationOptsValidator } from 'convex/server';
import {
  companySizeValidator,
  enterpriseInquiryStatusValidator,
} from '../schema';

// Base inquiry shape for validators
const inquiryObjectValidator = v.object({
  _id: v.id('enterpriseInquiries'),
  _creationTime: v.number(),
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  jobTitle: v.string(),
  companyName: v.string(),
  companyWebsite: v.optional(v.string()),
  companySize: companySizeValidator,
  industry: v.string(),
  expectedUsers: v.number(),
  useCase: v.string(),
  currentSolution: v.optional(v.string()),
  timeline: v.string(),
  budget: v.optional(v.string()),
  additionalRequirements: v.optional(v.string()),
  interestedFeatures: v.array(v.string()),
  status: enterpriseInquiryStatusValidator,
  adminNotes: v.optional(v.string()),
  respondedAt: v.optional(v.number()),
  respondedBy: v.optional(v.id('users')),
  userId: v.optional(v.id('users')),
  organizationId: v.optional(v.id('organizations')),
  confirmationEmailSent: v.boolean(),
  adminNotificationSent: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * List all enterprise inquiries (admin only).
 * Supports pagination and filtering by status.
 */
export const list = protectedAdminQuery({
  args: {
    status: v.optional(enterpriseInquiryStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(inquiryObjectValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const { status, paginationOpts } = args;

    let query;
    if (status) {
      query = ctx.db
        .query('enterpriseInquiries')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc');
    } else {
      query = ctx.db.query('enterpriseInquiries').order('desc');
    }

    return await query.paginate(paginationOpts);
  },
});

/**
 * Get a single enterprise inquiry by ID (admin only).
 */
export const getById = protectedAdminQuery({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.union(inquiryObjectValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.inquiryId);
  },
});

/**
 * Get statistics about enterprise inquiries (admin only).
 */
export const getStats = protectedAdminQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    pending: v.number(),
    contacted: v.number(),
    approved: v.number(),
    rejected: v.number(),
    converted: v.number(),
    thisWeek: v.number(),
    thisMonth: v.number(),
  }),
  handler: async (ctx) => {
    const all = await ctx.db.query('enterpriseInquiries').collect();

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      total: all.length,
      pending: all.filter((i) => i.status === 'pending').length,
      contacted: all.filter((i) => i.status === 'contacted').length,
      approved: all.filter((i) => i.status === 'approved').length,
      rejected: all.filter((i) => i.status === 'rejected').length,
      converted: all.filter((i) => i.status === 'converted').length,
      thisWeek: all.filter((i) => i.createdAt >= oneWeekAgo).length,
      thisMonth: all.filter((i) => i.createdAt >= oneMonthAgo).length,
    };
  },
});

