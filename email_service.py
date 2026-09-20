# email_service.py
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from config import SMTP_CONFIG


def send_email(to_email: str, subject: str, html_content: str, text_content: str = None) -> tuple[bool, str]:
    """
    Sends an email using configured SMTP settings.
    Supports Port 465 (SSL) and Port 587/25 (STARTTLS).
    Returns (success: bool, message: str).
    """
    smtp_server = SMTP_CONFIG.get('server', 'smtp.gmail.com')
    smtp_port   = int(SMTP_CONFIG.get('port', 587))
    smtp_user   = SMTP_CONFIG.get('username', '').strip()
    smtp_pass   = SMTP_CONFIG.get('password', '').strip()
    sender_name = SMTP_CONFIG.get('sender_name', 'FinanceOS Security')
    from_addr   = SMTP_CONFIG.get('from_email', smtp_user or 'noreply@financeos.com')

    if not smtp_user or not smtp_pass:
        msg = f"[SMTP NOT CONFIGURED] Email to '{to_email}' skipped (Set SMTP_USERNAME & SMTP_PASSWORD in .env)"
        print(f"\n{'='*70}\n{msg}\nSubject: {subject}\n{'='*70}\n")
        return False, "SMTP credentials not configured."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{sender_name} <{from_addr}>"
    msg["To"]      = to_email

    if text_content:
        msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if smtp_port == 465:
            # Direct SSL connection
            with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_addr, [to_email], msg.as_string())
        else:
            # STARTTLS connection (standard for port 587)
            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_addr, [to_email], msg.as_string())

        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SUCCESS: Email sent to {to_email} (Subject: '{subject}')")
        return True, "Email dispatched successfully."
    except Exception as e:
        err_msg = f"Failed to send email to {to_email}: {e}"
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SMTP ERROR: {err_msg}")
        return False, err_msg


def send_password_reset_email(to_email: str, username: str, reset_link: str) -> tuple[bool, str]:
    """Dispatches a password reset email with secure 1-hour token."""
    subject = "FinanceOS — Secure Password Reset Request"
    
    text_content = f"""Hello {username},

A password reset was requested for your FinanceOS account.
Please visit the link below to set a new password:
{reset_link}

This link will expire in 1 hour.
If you did not request this reset, you can safely ignore this email.

— The FinanceOS Security Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.15));border-bottom:1px solid #1f2937;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                <span style="color:#6366f1;">Finance</span><span style="color:#10b981;">OS</span>
              </h1>
              <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                Account Security Center
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">
                Password Reset Request
              </h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d1d5db;">
                Hello <strong style="color:#ffffff;">{username}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#9ca3af;">
                We received a request to reset the password for your FinanceOS account registered with <span style="color:#6366f1;">{to_email}</span>. Click the button below to choose a new password.
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="{reset_link}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg, #10b981, #059669);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;box-shadow:0 4px 14px rgba(16,185,129,0.4);letter-spacing:0.2px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;margin:24px 0 16px;">
                <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.5;">
                  <strong>Notice:</strong> This reset link is valid for <strong>1 hour</strong>. If you did not initiate this request, you can safely ignore this email—your existing password remains secure.
                </p>
              </div>

              <p style="margin:20px 0 6px;font-size:12px;color:#6b7280;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;color:#6366f1;word-break:break-all;">
                {reset_link}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#0d111c;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                Sent securely by FinanceOS Platform • Automated Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return send_email(to_email, subject, html_content, text_content)


def send_welcome_email(to_email: str, username: str, app_url: str = "http://localhost:5173") -> tuple[bool, str]:
    """Dispatches an onboarding welcome email upon user registration."""
    subject = "Welcome to FinanceOS — Your Financial Journey Begins"

    text_content = f"""Hello {username},

Welcome to FinanceOS! Your account has been registered successfully.

Here is what you can do right away:
- Track Income & Expenses with auto-categorization
- Scan receipts & utility bills with AI vision
- Set monthly budgets with rollover tracking
- Split group expenses with friends and track settlements
- Monitor your 0-1000 Financial Health Index

Access your dashboard here:
{app_url}

Best regards,
The FinanceOS Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.2));border-bottom:1px solid #1f2937;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">
                <span style="color:#6366f1;">Finance</span><span style="color:#10b981;">OS</span>
              </h1>
              <p style="margin:6px 0 0;font-size:14px;color:#a7f3d0;font-weight:500;">
                Account Setup Complete
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">
                Welcome aboard, {username}!
              </h2>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#d1d5db;">
                Thank you for joining FinanceOS. Your intelligent platform for tracking expenses, budgets, savings goals, and shared expenses is ready.
              </p>

              <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h3 style="margin:0 0 12px;font-size:14px;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;">Key Features Ready For You:</h3>
                <ul style="margin:0;padding-left:20px;color:#9ca3af;font-size:14px;line-height:1.8;">
                  <li><strong style="color:#ffffff;">AI Receipt & Bill Scanner:</strong> Snap any receipt to auto-log amounts & dates.</li>
                  <li><strong style="color:#ffffff;">Budgeting & Rollover:</strong> Prevent overspending with real-time alerts.</li>
                  <li><strong style="color:#ffffff;">Peer Expense Splitting:</strong> Calculate optimal settlements for trips and dinners.</li>
                  <li><strong style="color:#ffffff;">Financial Health Score:</strong> Track your 0-1000 financial wellness index.</li>
                </ul>
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{app_url}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg, #6366f1, #4f46e5);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">
                      Open My Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#0d111c;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                FinanceOS Platform • Registered Email: {to_email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return send_email(to_email, subject, html_content, text_content)
