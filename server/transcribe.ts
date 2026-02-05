import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { speechToText } from "./replit_integrations/audio/client";

export async function transcribeClip(
  audioUrl: string,
  timestampMs: number,
  durationMs: number
): Promise<string> {
  const startSeconds = Math.floor(timestampMs / 1000);
  const durationSeconds = Math.min(Math.ceil(durationMs / 1000), 300);

  const outputPath = join(tmpdir(), `clip-${randomUUID()}.wav`);

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-ss", String(startSeconds),
        "-i", audioUrl,
        "-t", String(durationSeconds),
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);

      let stderrOutput = "";
      ffmpeg.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderrOutput.slice(-500)}`));
      });
      ffmpeg.on("error", reject);
    });

    const audioBuffer = await readFile(outputPath);

    if (audioBuffer.length < 1000) {
      throw new Error("Audio clip is too short or empty");
    }

    const transcript = await speechToText(audioBuffer, "wav");
    return transcript;
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}
