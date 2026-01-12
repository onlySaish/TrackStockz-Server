import { google } from "googleapis";
import { gmailOAuthClient } from "./googleConfig.js";

export const sendMail = async ({ to, subject, html }) => {
  const gmail = google.gmail({
    version: "v1",
    auth: gmailOAuthClient,
  });

  const message = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    html,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
};
