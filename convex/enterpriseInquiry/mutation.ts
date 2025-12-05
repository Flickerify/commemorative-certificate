import { v } from 'convex/values';
import { publicMutation, protectedMutation } from '../functions';
import { companySizeValidator } from '../schema';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

type SubmitResult = {
  success: boolean;
  inquiryId?: Id<'enterpriseInquiries'>;
  message: string;
};

/**
 * Submit an enterprise inquiry.
 * This is a public mutation - can be called without authentication.
 */
export const submit = publicMutation({
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
  },
  returns: v.object({
    success: v.boolean(),
    inquiryId: v.optional(v.id('enterpriseInquiries')),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<SubmitResult> => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      return {
        success: false,
        message: 'Please provide a valid email address.',
      };
    }

    // Validate required fields have content
    if (args.firstName.trim().length < 1) {
      return {
        success: false,
        message: 'First name is required.',
      };
    }

    if (args.lastName.trim().length < 1) {
      return {
        success: false,
        message: 'Last name is required.',
      };
    }

    if (args.companyName.trim().length < 2) {
      return {
        success: false,
        message: 'Company name must be at least 2 characters.',
      };
    }

    if (args.useCase.trim().length < 20) {
      return {
        success: false,
        message: 'Please provide more details about your use case (at least 20 characters).',
      };
    }

    if (args.expectedUsers < 1) {
      return {
        success: false,
        message: 'Expected users must be at least 1.',
      };
    }

    if (args.interestedFeatures.length === 0) {
      return {
        success: false,
        message: 'Please select at least one feature you are interested in.',
      };
    }

    // Check for existing pending inquiry with same email
    const hasPending = await ctx.runQuery(internal.enterpriseInquiry.internal.query.hasPendingInquiry, {
      email: args.email,
    });

    if (hasPending) {
      return {
        success: false,
        message: 'You already have a pending inquiry. Our team will contact you soon.',
      };
    }

    // Create the inquiry
    const inquiryId: Id<'enterpriseInquiries'> = await ctx.runMutation(
      internal.enterpriseInquiry.internal.mutation.create,
      {
        firstName: args.firstName.trim(),
        lastName: args.lastName.trim(),
        email: args.email.toLowerCase().trim(),
        phone: args.phone?.trim(),
        jobTitle: args.jobTitle.trim(),
        companyName: args.companyName.trim(),
        companyWebsite: args.companyWebsite?.trim(),
        companySize: args.companySize,
        industry: args.industry.trim(),
        expectedUsers: args.expectedUsers,
        useCase: args.useCase.trim(),
        currentSolution: args.currentSolution?.trim(),
        timeline: args.timeline,
        budget: args.budget?.trim(),
        additionalRequirements: args.additionalRequirements?.trim(),
        interestedFeatures: args.interestedFeatures,
      },
    );

    // Schedule emails (non-blocking)
    await ctx.scheduler.runAfter(0, internal.enterpriseInquiry.email.sendCustomerConfirmation, {
      inquiryId,
    });
    await ctx.scheduler.runAfter(0, internal.enterpriseInquiry.email.sendAdminNotification, {
      inquiryId,
    });

    return {
      success: true,
      inquiryId,
      message: 'Thank you for your interest! Our team will contact you within 1-2 business days.',
    };
  },
});

/**
 * Submit an enterprise inquiry as authenticated user.
 * Links the inquiry to the user's account.
 */
export const submitAuthenticated = protectedMutation({
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
    organizationId: v.optional(v.id('organizations')),
  },
  returns: v.object({
    success: v.boolean(),
    inquiryId: v.optional(v.id('enterpriseInquiries')),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<SubmitResult> => {
    const { user } = ctx;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      return {
        success: false,
        message: 'Please provide a valid email address.',
      };
    }

    // Validate required fields
    if (args.firstName.trim().length < 1) {
      return {
        success: false,
        message: 'First name is required.',
      };
    }

    if (args.lastName.trim().length < 1) {
      return {
        success: false,
        message: 'Last name is required.',
      };
    }

    if (args.companyName.trim().length < 2) {
      return {
        success: false,
        message: 'Company name must be at least 2 characters.',
      };
    }

    if (args.useCase.trim().length < 20) {
      return {
        success: false,
        message: 'Please provide more details about your use case (at least 20 characters).',
      };
    }

    if (args.expectedUsers < 1) {
      return {
        success: false,
        message: 'Expected users must be at least 1.',
      };
    }

    if (args.interestedFeatures.length === 0) {
      return {
        success: false,
        message: 'Please select at least one feature you are interested in.',
      };
    }

    // Check for existing pending inquiry
    const hasPending = await ctx.runQuery(internal.enterpriseInquiry.internal.query.hasPendingInquiry, {
      email: args.email,
    });

    if (hasPending) {
      return {
        success: false,
        message: 'You already have a pending inquiry. Our team will contact you soon.',
      };
    }

    // Create the inquiry with user and org links
    const inquiryId: Id<'enterpriseInquiries'> = await ctx.runMutation(
      internal.enterpriseInquiry.internal.mutation.create,
      {
        firstName: args.firstName.trim(),
        lastName: args.lastName.trim(),
        email: args.email.toLowerCase().trim(),
        phone: args.phone?.trim(),
        jobTitle: args.jobTitle.trim(),
        companyName: args.companyName.trim(),
        companyWebsite: args.companyWebsite?.trim(),
        companySize: args.companySize,
        industry: args.industry.trim(),
        expectedUsers: args.expectedUsers,
        useCase: args.useCase.trim(),
        currentSolution: args.currentSolution?.trim(),
        timeline: args.timeline,
        budget: args.budget?.trim(),
        additionalRequirements: args.additionalRequirements?.trim(),
        interestedFeatures: args.interestedFeatures,
        userId: user._id,
        organizationId: args.organizationId,
      },
    );

    // Schedule emails
    await ctx.scheduler.runAfter(0, internal.enterpriseInquiry.email.sendCustomerConfirmation, {
      inquiryId,
    });
    await ctx.scheduler.runAfter(0, internal.enterpriseInquiry.email.sendAdminNotification, {
      inquiryId,
    });

    return {
      success: true,
      inquiryId,
      message: 'Thank you for your interest! Our team will contact you within 1-2 business days.',
    };
  },
});
