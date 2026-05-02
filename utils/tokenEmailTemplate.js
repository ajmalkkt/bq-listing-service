export const getTokenEmailTemplate = (name, token) => {
    // Current year for footer
    const year = new Date().getFullYear();

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your API Key - BrowseQatar</title>
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
  
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8;">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          
          <!-- Main Email Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden;">
            
            <!-- Header -->
            <tr>
              <td align="center" style="background-color: #1e293b; padding: 30px 20px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Browse<span style="color: #3b82f6;">Qatar</span></h1>
              </td>
            </tr>
  
            <!-- Body Content -->
            <tr>
              <td class="padding-box" style="padding: 40px 40px 30px 40px; color: #334155; text-align: left;">
                
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  Hello ${name},
                </p>
                
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  Thank you for your recent discussion with us and for agreeing to our <a href="https://browseqatar.com/terms" style="color: #3b82f6; text-decoration: none;">terms and conditions</a>. We are excited to have you on board.
                </p>
  
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  Hope you have received an email related to account creation and temporary password. Immediately reset your password of your choice using the "Forgot Password" option found in the Login page to ensure your account security.
                </p>
  
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  Once you are done with password reset, please login to <a href="https://browseqatar.com" style="color: #3b82f6; text-decoration: none;">browseqatar.com</a> and go to <strong>Manage Offer</strong> from the menu (top right corner burger menu) and start creating the offers. You may please refer the <strong>User Guide</strong> page given in the Manage Offer page for any help.
                </p>
  
                <!-- Token Section -->
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px; margin-bottom: 30px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                    Your API Key
                  </p>
                  <p style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b; font-family: monospace; word-break: break-all; background-color: #e2e8f0; padding: 10px; border-radius: 4px;">
                    <strong>${token}</strong>
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #ef4444; font-weight: bold;">
                    Important: PLEASE DO NOT SHARE THIS TOKEN WITH ANYONE.
                  </p>
                </div>
  
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                  Please enter this key on top section of <strong>Manage Offers</strong> page to successfully add your restaurant and offers.
                </p>
  
                <p style="font-size: 16px; line-height: 24px; margin: 0;">
                  Thank you for choosing BrowseQatar. We look forward to helping you reach more customers.
                </p>
                
                <br>
                
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
                  You received this email because you are a registered partner.
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
