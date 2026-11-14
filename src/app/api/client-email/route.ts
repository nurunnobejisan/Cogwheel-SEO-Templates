import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      action = "draft", // "draft" | "send" | "preview"
      to = "",
      subject = "",
      body = "",
      propertyName = "Hotel Property",
    } = payload;

    if (!subject || !body) {
      return NextResponse.json(
        { error: "Subject and Body are required." },
        { status: 400 }
      );
    }

    // Compose URL for Gmail Web Direct 1-Click
    const webComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      to
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        preview: { to, subject, body },
        webComposeUrl,
        mailtoUrl,
      });
    }

    // Try executing through gmail CLI if available and authenticated
    const gmailCliPath = "/Users/jisanjomadder/.gemini/antigravity/bin/gmail";
    let cliResult: { success: boolean; message: string; output?: string } = {
      success: false,
      message: "Direct web compose link generated.",
    };

    if (fs.existsSync(gmailCliPath)) {
      try {
        const tmpFile = path.join(
          os.tmpdir(),
          `cogwheel-email-${Date.now()}.txt`
        );
        fs.writeFileSync(tmpFile, body, "utf8");

        const subcommand = action === "send" ? "send" : "create-draft";
        const cmd = `${gmailCliPath} mutate ${subcommand} --to "${to.replace(
          /"/g,
          '\\"'
        )}" --subject "${subject.replace(
          /"/g,
          '\\"'
        )}" --body-file "${tmpFile}" --json`;

        const { stdout } = await execAsync(cmd, {
          env: {
            ...process.env,
            AGY_ACCOUNT: "riboynjsr@gmail.com",
          },
          timeout: 7000,
        });

        fs.unlinkSync(tmpFile);
        cliResult = {
          success: true,
          message:
            action === "send"
              ? "Email sent successfully via Gmail!"
              : "Draft created in riboynjsr@gmail.com inbox!",
          output: stdout,
        };
      } catch (cliErr: any) {
        // CLI fallback is graceful
        cliResult = {
          success: false,
          message:
            "Draft prepared! Click 'Open in Gmail' to review and dispatch directly from your inbox.",
        };
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      cliResult,
      webComposeUrl,
      mailtoUrl,
      account: "riboynjsr@gmail.com",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process email request." },
      { status: 500 }
    );
  }
}
