/**
 * Client email composer.
 *
 * Default behaviour is side-effect free: the route returns Gmail compose and
 * `mailto:` links that the operator opens in their own client.
 *
 * An optional local Gmail CLI bridge exists for desktop use. It is off unless
 * `COGWHEEL_ALLOW_LOCAL_MAIL_CLI=1` (never enable on a deployed server) and it
 * uses `execFile` with an argument array — never a shell string — so recipient
 * or subject values cannot inject commands.
 */

import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

const MAX_SUBJECT = 300;
const MAX_BODY = 50_000;
const EMAIL_PATTERN = /^[^\s@,;:<>"]{1,64}@[^\s@,;:<>"]{1,190}\.[A-Za-z]{2,}$/;

interface EmailPayload {
  action?: "draft" | "send" | "preview";
  to?: string;
  subject?: string;
  body?: string;
  propertyName?: string;
}

function normalizeRecipients(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as EmailPayload;
    const action = payload.action ?? "draft";
    const to = (payload.to ?? "").trim();
    const subject = (payload.subject ?? "").trim();
    const body = payload.body ?? "";

    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and Body are required." }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: "Subject is too long." }, { status: 400 });
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json({ error: "Body is too long." }, { status: 400 });
    }

    const recipients = normalizeRecipients(to);
    const invalid = recipients.filter((address) => !EMAIL_PATTERN.test(address));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid recipient address: ${invalid[0]}` },
        { status: 400 },
      );
    }

    const webComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipients.join(","),
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const mailtoUrl = `mailto:${encodeURIComponent(
      recipients.join(","),
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        preview: { to: recipients.join(", "), subject, body },
        webComposeUrl,
        mailtoUrl,
      });
    }

    const cliEnabled = process.env.COGWHEEL_ALLOW_LOCAL_MAIL_CLI === "1";
    const gmailCliPath = process.env.COGWHEEL_MAIL_CLI_PATH ?? "";
    const account = process.env.COGWHEEL_MAIL_ACCOUNT ?? "";

    let cliResult: { success: boolean; message: string; output?: string } = {
      success: false,
      message: "Direct web compose link generated.",
    };

    if (cliEnabled && gmailCliPath && fs.existsSync(gmailCliPath)) {
      const tmpFile = path.join(os.tmpdir(), `seo-studio-email-${Date.now()}-${process.pid}.txt`);
      try {
        fs.writeFileSync(tmpFile, body, { encoding: "utf8", mode: 0o600 });

        const subcommand = action === "send" ? "send" : "create-draft";
        const args = [
          "mutate",
          subcommand,
          "--to",
          recipients.join(","),
          "--subject",
          subject,
          "--body-file",
          tmpFile,
          "--json",
        ];

        const { stdout } = await execFileAsync(gmailCliPath, args, {
          env: {
            ...process.env,
            ...(account ? { AGY_ACCOUNT: account } : {}),
          },
          timeout: 7000,
          maxBuffer: 1024 * 1024,
        });

        cliResult = {
          success: true,
          message:
            action === "send"
              ? "Email sent successfully via Gmail."
              : "Draft created in the configured Gmail account.",
          output: stdout,
        };
      } catch {
        cliResult = {
          success: false,
          message:
            "Draft prepared. Use 'Open in Gmail' to review and send it from your inbox.",
        };
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // temp file may not have been created
        }
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      cliResult,
      webComposeUrl,
      mailtoUrl,
      ...(account ? { account } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process email request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}