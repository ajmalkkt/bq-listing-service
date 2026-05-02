import sgMail from "@sendgrid/mail";
import nodemailer from 'nodemailer';
import getReplyTemplate from '../utils/replyTemplate.js';
import { getAccountCreatedTemplate } from '../utils/accountCreatedTemplate.js';
import { getTokenEmailTemplate } from '../utils/tokenEmailTemplate.js';


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// For more secure options, you can configure SMTP settings directly
const privateTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 465,
  secure: process.env.EMAIL_SECURE === 'true', // use false for STARTTLS; true for SSL on port 465
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASS
  },
  //logger: true, // Enable logging
  //debug: true // Enable debug output
});


/**
 * Sends an enquiry email to the configured business address
 * @param {string} name - Name of the user submitting the enquiry
 * @param {string} email - User's email
 * @param {string} message - Enquiry message content
 */
export const sendEmail = async (name, email, phone, message) => {
  const msg = getMailOptions(name, phone, email, message);

  try {
    await sgMail.send(msg);
    console.log("✅ Enquiry email sent successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ emailService.js:Failed to send enquiry email:", error);
    return { success: false, error };
  }
};

//using nodemailer package.
export const sendEmailUsingNodemailer = async (name, email, phone, message) => {
  const mailOptions = getMailOptions(name, phone, email, message);

  try {
    const info = await privateTransporter.sendMail(mailOptions);
    console.log('emailService.js:Email sent: ' + info.response);
    return { success: true };
  } catch (error) {
    console.error('emailService.js:Error sending email:', error);
    throw error;
  }
};

export const sendReplyEmailUsingNodemailer = async (name, email, message) => {
  const htmlEmail = getReplyTemplate(name, message);
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email, // The customer's email
    subject: 'We received your enquiry - BrowseQatar',
    text: `Hello ${name}, thank you for contacting us. We have received your message: "${message}". We will reply shortly.`, // Fallback
    html: htmlEmail,
  };

  try {
    const info = await privateTransporter.sendMail(mailOptions);
    console.log('emailService.js:Reply Email sent: ' + info.response);
    return { success: true };
  } catch (error) {
    console.error('emailService.js:Error sending replyemail:', error);
    throw error;
  }
};

//add tempPassword to reply email
export const sendAccountCreatedEmail = async (name, email, tempPassword) => {
  const htmlEmail = getAccountCreatedTemplate(name, email, tempPassword);
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email, // The customer's email
    subject: 'Welcome to BrowseQatar - Account Created',
    text: `Hello ${name}, your account has been created. Email: ${email}, Temporary Password: ${tempPassword}. Please log in and reset your password immediately.`, // Fallback
    html: htmlEmail,
  };

  try {
    const info = await privateTransporter.sendMail(mailOptions);
    console.log('emailService.js:Account Created Email sent: ' + info.response);
    return { success: true };
  } catch (error) {
    console.error('emailService.js:Error sending account created email:', error);
    throw error;
  }
};

// Send API Token Email
export const sendTokenEmail = async (name, email, token) => {
  const htmlEmail = getTokenEmailTemplate(name, token);
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email, // The customer's email
    subject: 'Your API Key for Manage Offers - BrowseQatar',
    text: `Hello ${name}, here is your API Key for managing offers: ${token}. Please do not share this token with anyone.`, // Fallback
    html: htmlEmail,
  };

  try {
    const info = await privateTransporter.sendMail(mailOptions);
    console.log('emailService.js:Token Email sent: ' + info.response);
    return { success: true };
  } catch (error) {
    console.error('emailService.js:Error sending token email:', error);
    throw error;
  }
};

function getMailOptions(name, phone, email, message) {
  // Generate the HTML content using your text
  //const htmlContent = createEmailTemplate(subject, message);
  return {
    from: process.env.FROM_EMAIL, // sender address to be of configured mail
    to: process.env.ENQUIRY_EMAIL,//can be any email to send enquiry to
    subject: `New Enquiry from ${name}`,
    text: message, // Fallback for email clients that don't support HTML
    html: `
      <h3>New Enquiry Received</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
  };
}
