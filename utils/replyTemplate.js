// utils/enquiryReplyTemplate.js

const getReplyTemplate = (name, userMessage) => {
  // Current year for footer
  const year = new Date().getFullYear();

  // Truncate message if it's too long for the email preview
  const displayMessage = userMessage.length > 200
    ? `${userMessage.substring(0, 200)}...`
    : userMessage;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your enquiry</title>
  <style>
    /* Client-specific resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* General Styles */
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f4f6f8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    
    /* Responsive */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .padding-box { padding: 20px !important; }
      .header-text { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8;">

  <!-- Preheader Text (Hidden) -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
    Thank you for contacting BrowseQatar. We have received your message and will get back to you shortly.
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        
        <!-- Main Email Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #1e293b; padding: 30px 20px;">
              <!-- You can replace this text with an <img> tag for your logo -->
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Browse<span style="color: #3b82f6;">Qatar</span></h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="padding-box" style="padding: 40px 40px 30px 40px; color: #334155; text-align: left;">
              
              <h2 style="font-size: 20px; font-weight: 600; color: #1e293b; margin: 0 0 20px 0;">
                Hello ${name},
              </h2>
              
              <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Thank you for reaching out to us. We have received your enquiry and our support team is currently reviewing it.
              </p>

              <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                We aim to respond to all queries within <strong>24-48 business hours</strong>. You don't need to do anything else at this moment.
              </p>

              <!-- Quoted Message Section -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                      Your Message:
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #475569; font-style: italic; line-height: 22px;">
                      "${displayMessage}"
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 16px; line-height: 24px; margin: 0;">
                Best regards,<br>
                <strong>The BrowseQatar Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f1f5f9; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 18px;">
                &copy; ${year} BrowseQatar. All rights reserved.<br>
                <a href="https://browseqatar.com/terms" style="color: #94a3b8; text-decoration: underline;">Terms and Conditions</a><br>
                You received this email because you contacted our support team.
              </p>
            </td>
          </tr>

        </table>
        
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};

export default getReplyTemplate;