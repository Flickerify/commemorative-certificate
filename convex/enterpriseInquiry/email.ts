import { components, internal } from '../_generated/api';
import { Resend } from '@convex-dev/resend';
import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

// Initialize Resend component
// Set testMode to false for production use
export const resend = new Resend(components.resend, {
  testMode: process.env.NODE_ENV !== 'production',
});

// Email templates
const ADMIN_EMAIL = 'admin@flickerify.com';
const FROM_EMAIL = 'Flickerify <noreply@flickerify.com>';

/**
 * Generate admin notification email HTML.
 */
function generateAdminNotificationEmail(inquiry: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  companyName: string;
  companyWebsite?: string;
  companySize: string;
  industry: string;
  expectedUsers: number;
  useCase: string;
  currentSolution?: string;
  timeline: string;
  budget?: string;
  additionalRequirements?: string;
  interestedFeatures: string[];
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Enterprise Inquiry</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🏢 New Enterprise Inquiry</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #495057; margin-top: 0;">Contact Information</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6c757d; width: 140px;">Name:</td>
        <td style="padding: 8px 0; font-weight: 500;">${inquiry.firstName} ${inquiry.lastName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Email:</td>
        <td style="padding: 8px 0;"><a href="mailto:${inquiry.email}" style="color: #667eea;">${inquiry.email}</a></td>
      </tr>
      ${inquiry.phone ? `
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Phone:</td>
        <td style="padding: 8px 0;">${inquiry.phone}</td>
      </tr>` : ''}
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Job Title:</td>
        <td style="padding: 8px 0;">${inquiry.jobTitle}</td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 24px 0;">

    <h2 style="color: #495057;">Company Information</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6c757d; width: 140px;">Company:</td>
        <td style="padding: 8px 0; font-weight: 500;">${inquiry.companyName}</td>
      </tr>
      ${inquiry.companyWebsite ? `
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Website:</td>
        <td style="padding: 8px 0;"><a href="${inquiry.companyWebsite}" style="color: #667eea;">${inquiry.companyWebsite}</a></td>
      </tr>` : ''}
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Company Size:</td>
        <td style="padding: 8px 0;">${inquiry.companySize} employees</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Industry:</td>
        <td style="padding: 8px 0;">${inquiry.industry}</td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 24px 0;">

    <h2 style="color: #495057;">Requirements</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6c757d; width: 140px;">Expected Users:</td>
        <td style="padding: 8px 0; font-weight: 500;">${inquiry.expectedUsers}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Timeline:</td>
        <td style="padding: 8px 0;">${inquiry.timeline}</td>
      </tr>
      ${inquiry.budget ? `
      <tr>
        <td style="padding: 8px 0; color: #6c757d;">Budget:</td>
        <td style="padding: 8px 0;">${inquiry.budget}</td>
      </tr>` : ''}
    </table>

    <div style="margin-top: 16px;">
      <p style="color: #6c757d; margin-bottom: 8px;">Use Case:</p>
      <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #dee2e6;">
        ${inquiry.useCase}
      </div>
    </div>

    ${inquiry.currentSolution ? `
    <div style="margin-top: 16px;">
      <p style="color: #6c757d; margin-bottom: 8px;">Current Solution:</p>
      <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #dee2e6;">
        ${inquiry.currentSolution}
      </div>
    </div>` : ''}

    ${inquiry.additionalRequirements ? `
    <div style="margin-top: 16px;">
      <p style="color: #6c757d; margin-bottom: 8px;">Additional Requirements:</p>
      <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #dee2e6;">
        ${inquiry.additionalRequirements}
      </div>
    </div>` : ''}

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 24px 0;">

    <h2 style="color: #495057;">Features of Interest</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${inquiry.interestedFeatures.map(feature => `
        <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 16px; font-size: 14px;">${feature}</span>
      `).join('')}
    </div>

    <div style="margin-top: 32px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.flickerify.com'}/admin/enterprise" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 500;">
        View in Admin Panel
      </a>
    </div>
  </div>
  
  <p style="color: #6c757d; font-size: 12px; text-align: center; margin-top: 24px;">
    This is an automated notification from Flickerify.
  </p>
</body>
</html>
  `;
}

/**
 * Generate customer confirmation email HTML.
 */
function generateCustomerConfirmationEmail(inquiry: {
  firstName: string;
  companyName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enterprise Inquiry Received</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✨ Thank You for Your Interest!</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px;">Hi ${inquiry.firstName},</p>
    
    <p>Thank you for your interest in Flickerify Enterprise for <strong>${inquiry.companyName}</strong>. We've received your inquiry and our team is excited to learn more about your needs.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #495057;">What Happens Next?</h3>
      <ol style="color: #6c757d; padding-left: 20px;">
        <li style="margin-bottom: 12px;">Our enterprise team will review your requirements within 1-2 business days.</li>
        <li style="margin-bottom: 12px;">We'll schedule a personalized demo call to understand your needs better.</li>
        <li style="margin-bottom: 12px;">You'll receive a custom proposal tailored to your organization.</li>
      </ol>
    </div>

    <p>In the meantime, feel free to explore our <a href="https://docs.flickerify.com" style="color: #667eea;">documentation</a> or reach out to us at <a href="mailto:enterprise@flickerify.com" style="color: #667eea;">enterprise@flickerify.com</a> if you have any immediate questions.</p>

    <p style="margin-top: 24px;">
      Best regards,<br>
      <strong>The Flickerify Team</strong>
    </p>
  </div>
  
  <p style="color: #6c757d; font-size: 12px; text-align: center; margin-top: 24px;">
    © ${new Date().getFullYear()} Flickerify. All rights reserved.
  </p>
</body>
</html>
  `;
}

/**
 * Send admin notification email about new enterprise inquiry.
 */
export const sendAdminNotification = internalMutation({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inquiry = await ctx.db.get(args.inquiryId);
    if (!inquiry) {
      console.error('Inquiry not found:', args.inquiryId);
      return null;
    }

    if (inquiry.adminNotificationSent) {
      console.log('Admin notification already sent for:', args.inquiryId);
      return null;
    }

    await resend.sendEmail(ctx, {
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🏢 New Enterprise Inquiry from ${inquiry.companyName}`,
      html: generateAdminNotificationEmail({
        firstName: inquiry.firstName,
        lastName: inquiry.lastName,
        email: inquiry.email,
        phone: inquiry.phone,
        jobTitle: inquiry.jobTitle,
        companyName: inquiry.companyName,
        companyWebsite: inquiry.companyWebsite,
        companySize: inquiry.companySize,
        industry: inquiry.industry,
        expectedUsers: inquiry.expectedUsers,
        useCase: inquiry.useCase,
        currentSolution: inquiry.currentSolution,
        timeline: inquiry.timeline,
        budget: inquiry.budget,
        additionalRequirements: inquiry.additionalRequirements,
        interestedFeatures: inquiry.interestedFeatures,
      }),
    });

    // Mark as sent
    await ctx.db.patch(args.inquiryId, {
      adminNotificationSent: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Send confirmation email to customer.
 */
export const sendCustomerConfirmation = internalMutation({
  args: {
    inquiryId: v.id('enterpriseInquiries'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inquiry = await ctx.db.get(args.inquiryId);
    if (!inquiry) {
      console.error('Inquiry not found:', args.inquiryId);
      return null;
    }

    if (inquiry.confirmationEmailSent) {
      console.log('Confirmation already sent for:', args.inquiryId);
      return null;
    }

    await resend.sendEmail(ctx, {
      from: FROM_EMAIL,
      to: inquiry.email,
      subject: `Thank you for your interest in Flickerify Enterprise`,
      html: generateCustomerConfirmationEmail({
        firstName: inquiry.firstName,
        companyName: inquiry.companyName,
      }),
    });

    // Mark as sent
    await ctx.db.patch(args.inquiryId, {
      confirmationEmailSent: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});

