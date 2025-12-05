import { v } from 'convex/values';
import { internalQuery } from '../../functions';
import {
  companySizeValidator,
  enterpriseInquiryStatusValidator,
} from '../../schema';

/**
 * Get an enterprise inquiry by ID.
 */
export const getById = internalQuery({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.union(
    v.object({
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const inquiry = await ctx.db.get(args.inquiryId);
    return inquiry;
  },
});

/**
 * Check if an email has already submitted a pending inquiry.
 */
export const hasPendingInquiry = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('enterpriseInquiries')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (!existing) return false;

    // Allow new submission if previous was rejected or converted
    return existing.status === 'pending' || existing.status === 'contacted';
  },
});

