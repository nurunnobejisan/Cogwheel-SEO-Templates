/**
 * Global Download Manager with visual countdown and completion feedback.
 */

export type SupportedFileFormat = "xlsx" | "csv" | "pptx" | "json" | "pdf" | "txt" | "file";

export interface DownloadRequest {
  id: string;
  filename: string;
  format: SupportedFileFormat;
  countdownSeconds?: number;
  execute: () => Promise<void> | void;
}

export type DownloadState =
  | { status: "idle" }
  | {
      status: "countdown";
      request: DownloadRequest;
      remainingSeconds: number;
      totalSeconds: number;
    }
  | {
      status: "downloading";
      request: DownloadRequest;
      progress: number;
    }
  | {
      status: "completed";
      request: DownloadRequest;
      completedAt: Date;
    };

type DownloadListener = (state: DownloadState) => void;

class DownloadManager {
  private state: DownloadState = { status: "idle" };
  private listeners = new Set<DownloadListener>();
  private countdownTimer: NodeJS.Timeout | null = null;
  private autoDismissTimer: NodeJS.Timeout | null = null;

  public getState(): DownloadState {
    return this.state;
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(newState: DownloadState) {
    this.state = newState;
    this.listeners.forEach((fn) => fn(newState));
  }

  public startDownload(opts: {
    filename: string;
    format?: SupportedFileFormat;
    countdownSeconds?: number;
    onExecute: () => Promise<void> | void;
  }) {
    this.clearTimers();

    const format = opts.format || detectFormat(opts.filename);
    const totalSeconds = opts.countdownSeconds ?? 3;

    const request: DownloadRequest = {
      id: Math.random().toString(36).substring(2, 9),
      filename: opts.filename,
      format,
      countdownSeconds: totalSeconds,
      execute: opts.onExecute,
    };

    let remaining = totalSeconds;
    this.notify({
      status: "countdown",
      request,
      remainingSeconds: remaining,
      totalSeconds,
    });

    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        this.notify({
          status: "countdown",
          request,
          remainingSeconds: remaining,
          totalSeconds,
        });
      } else {
        this.clearTimers();
        void this.triggerExecution(request);
      }
    }, 1000);
  }

  public skipCountdown() {
    if (this.state.status === "countdown") {
      const { request } = this.state;
      this.clearTimers();
      void this.triggerExecution(request);
    }
  }

  public cancel() {
    this.clearTimers();
    this.notify({ status: "idle" });
  }

  public dismiss() {
    this.clearTimers();
    this.notify({ status: "idle" });
  }

  private async triggerExecution(request: DownloadRequest) {
    this.notify({
      status: "downloading",
      request,
      progress: 60,
    });

    try {
      await request.execute();
      this.notify({
        status: "downloading",
        request,
        progress: 100,
      });

      // Brief delay to showcase completion transition
      setTimeout(() => {
        this.notify({
          status: "completed",
          request,
          completedAt: new Date(),
        });

        // Auto-dismiss after 4 seconds
        this.autoDismissTimer = setTimeout(() => {
          this.dismiss();
        }, 4000);
      }, 400);
    } catch (err) {
      console.error("Download execution failed:", err);
      this.notify({ status: "idle" });
    }
  }

  private clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }
}

export const downloadManager = new DownloadManager();

export function detectFormat(filename: string): SupportedFileFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "xlsx":
    case "xls":
      return "xlsx";
    case "csv":
      return "csv";
    case "pptx":
    case "ppt":
      return "pptx";
    case "json":
      return "json";
    case "pdf":
      return "pdf";
    case "txt":
      return "txt";
    default:
      return "file";
  }
}

/**
 * Standard trigger to download text/csv with countdown
 */
export function downloadTextWithCountdown(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
  countdownSeconds = 3,
) {
  downloadManager.startDownload({
    filename,
    countdownSeconds,
    onExecute: () => {
      const blob = new Blob([text], { type: mime });
      saveBlobLocally(blob, filename);
    },
  });
}

/**
 * Standard trigger to download blob with countdown
 */
export function downloadBlobWithCountdown(
  blob: Blob,
  filename: string,
  countdownSeconds = 3,
) {
  downloadManager.startDownload({
    filename,
    countdownSeconds,
    onExecute: () => {
      saveBlobLocally(blob, filename);
    },
  });
}

/**
 * Standard trigger to download base64 content with countdown
 */
export function downloadBase64WithCountdown(
  base64: string,
  filename: string,
  mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  countdownSeconds = 3,
) {
  downloadManager.startDownload({
    filename,
    countdownSeconds,
    onExecute: () => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      saveBlobLocally(blob, filename);
    },
  });
}

export function saveBlobLocally(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
