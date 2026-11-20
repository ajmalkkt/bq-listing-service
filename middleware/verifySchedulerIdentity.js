import { OAuth2Client } from "google-auth-library";

const oauthClient = new OAuth2Client();

export const verifySchedulerIdentity = async (req, res, next) => {
  const audience = process.env.FAVORITES_SCHEDULER_AUDIENCE;
  const serviceAccount = process.env.FAVORITES_SCHEDULER_SERVICE_ACCOUNT;
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!audience || !serviceAccount) {
    return res.status(503).json({ message: "Scheduler identity is not configured" });
  }
  if (!token) return res.status(401).json({ message: "Scheduler identity token is required" });
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== serviceAccount) {
      return res.status(403).json({ message: "Scheduler service account is not authorized" });
    }
    req.schedulerIdentity = payload.email;
    return next();
  } catch (error) {
    console.error("Scheduler OIDC verification failed:", error.message);
    return res.status(403).json({ message: "Invalid scheduler identity token" });
  }
};
