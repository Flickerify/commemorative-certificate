import { v, ConvexError } from 'convex/values';
import { protectedAdminAction } from '../functions';
import { internal } from '../_generated/api';
import { enterpriseInquiryStatusValidator } from '../schema';

/**
 * Update the status of an enterprise inquiry (admin only).
 */
export const updateStatus = protectedAdminAction({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
    status: enterpriseInquiryStatusValidator,
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { user } = ctx;

    // Get current inquiry
    const inquiry = await ctx.runQuery(internal.enterpriseInquiry.internal.query.getById, {
      inquiryId: args.inquiryId,
    });

    if (!inquiry) {
      throw new ConvexError('Inquiry not found');
    }

    // Update the status
    await ctx.runMutation(internal.enterpriseInquiry.internal.mutation.updateStatus, {
      inquiryId: args.inquiryId,
      status: args.status,
      adminNotes: args.adminNotes,
      respondedBy: user._id,
    });

    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      contacted: 'Contacted',
      approved: 'Approved',
      rejected: 'Rejected',
      converted: 'Converted',
    };

    return {
      success: true,
      message: `Status updated to "${statusLabels[args.status]}"`,
    };
  },
});

