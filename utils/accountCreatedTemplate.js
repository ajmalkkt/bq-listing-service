export const getAccountCreatedTemplate = (name, email, tempPassword) => {
  // Current year for footer
  const year = new Date().getFullYear();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Created - BrowseQatar</title>
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
                
                <h2 style="font-size: 20px; font-weight: 600; color: #1e293b; margin: 0 0 20px 0;">
                  Welcome to BrowseQatar, ${name}!
                </h2>
                
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  Thank you for your recent discussion with us and for agreeing to our <a href="https://browseqatar.com/terms" style="color: #3b82f6; text-decoration: none;">terms and conditions</a>. We are excited to have you on board.
                </p>
  
                <p style="font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                  We have successfully created a new account for you to start adding your restaurant offers to our platform.
                </p>
  
                <!-- Credentials Section -->
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px; margin-bottom: 30px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                    Your Login Credentials
                  </p>
                  <p style="margin: 0 0 5px 0; font-size: 16px; color: #334155;">
                    <strong>Email:</strong> ${email}
                  </p>
                  <p style="margin: 0; font-size: 16px; color: #334155;">
                    <strong>Temporary Password:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 2px 5px; border-radius: 3px;">${tempPassword}</span>
                  </p>
                </div>
  
                <h3 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 15px 0;">
                  Next Steps
                </h3>
                
                <ol style="font-size: 16px; line-height: 24px; margin: 0 0 30px 0; padding-left: 20px; color: #334155;">
                  <li style="margin-bottom: 10px;">Log in to your account using the credentials above.</li>
                  <li style="margin-bottom: 10px;"><strong>Important:</strong> Immediately reset your password using the "Forgot Password" option found in the Login module to ensure your account security.</li>
                  <li style="margin-bottom: 10px;">To read the admin user guide - <strong>Login to browseqatar.com</strong> and go to <strong>Manage Offer</strong> from the menu (top right corner burger menu) and click on <strong>User Guide</strong>.</li>
                  <li>Start creating and managing your offers!</li>
                </ol>
  
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

