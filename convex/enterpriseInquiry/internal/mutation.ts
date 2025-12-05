import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { companySizeValidator, enterpriseInquiryStatusValidator } from '../../schema';

/**
 * Create a new enterprise inquiry request.
 */
export const create = internalMutation({
  args: {
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
    userId: v.optional(v.id('users')),
    organizationId: v.optional(v.id('organizations')),
  },
  returns: v.id('enterpriseInquiries'),
  handler: async (ctx, args) => {
    const now = Date.now();

    const id = await ctx.db.insert('enterpriseInquiries', {
      ...args,
      status: 'pending',
      confirmationEmailSent: false,
      adminNotificationSent: false,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update the status of an enterprise inquiry.
 */
export const updateStatus = internalMutation({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
    status: enterpriseInquiryStatusValidator,
    adminNotes: v.optional(v.string()),
    respondedBy: v.optional(v.id('users')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { inquiryId, status, adminNotes, respondedBy } = args;
    const now = Date.now();

    await ctx.db.patch(inquiryId, {
      status,
      ...(adminNotes !== undefined && { adminNotes }),
      ...(respondedBy && { respondedBy }),
      ...(status !== 'pending' && { respondedAt: now }),
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Mark confirmation email as sent.
 */
export const markConfirmationEmailSent = internalMutation({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inquiryId, {
      confirmationEmailSent: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Mark admin notification email as sent.
 */
export const markAdminNotificationSent = internalMutation({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inquiryId, {
      adminNotificationSent: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

