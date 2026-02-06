import { spawn } from "child_process";
import { writeFile, unlink, readFile, stat } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { speechToText } from "./replit_integrations/audio/client";
import { storage } from "./storage";
import type { TranscriptSegment } from "@shared/schema";

const CHUNK_DURATION_SECONDS = 120;

async function getAudioDuration(audioUrl: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioUrl,
    ]);

    let output = "";
    let stderrOutput = "";
    ffprobe.stdout.on("data", (data) => { output += data.toString(); });
    ffprobe.stderr.on("data", (data) => { stderrOutput += data.toString(); });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) reject(new Error("Could not parse duration"));
        else resolve(duration);
      } else {
        reject(new Error(`ffprobe failed: ${stderrOutput.slice(-300)}`));
      }
    });
    ffprobe.on("error", reject);
  });
}

async function extractAndTranscribeChunk(
  audioUrl: string,
  startSeconds: number,
  durationSeconds: number
): Promise<{ text: string }> {
  const outputPath = join(tmpdir(), `chunk-${randomUUID()}.wav`);

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

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg chunk extraction failed with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    const audioBuffer = await readFile(outputPath);
    if (audioBuffer.length < 1000) {
      return { text: "" };
    }

    const text = await speechToText(audioBuffer, "wav");
    return { text };
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

export async function transcribeFullEpisode(transcriptId: string, audioUrl: string): Promise<void> {
  try {
    let totalDuration: number;
    try {
      totalDuration = await getAudioDuration(audioUrl);
    } catch (err) {
      await storage.updateEpisodeTranscript(transcriptId, {
        status: "error",
        errorMessage: "Could not determine episode duration. The audio URL may be invalid or expired.",
      });
      return;
    }

    const totalChunks = Math.ceil(totalDuration / CHUNK_DURATION_SECONDS);

    await storage.updateEpisodeTranscript(transcriptId, {
      status: "processing",
      totalChunks,
      progress: 0,
    });

    const segments: TranscriptSegment[] = [];
    let failedChunks = 0;

    for (let i = 0; i < totalChunks; i++) {
      const startSeconds = i * CHUNK_DURATION_SECONDS;
      const chunkDuration = Math.min(CHUNK_DURATION_SECONDS, totalDuration - startSeconds);

      try {
        const { text } = await extractAndTranscribeChunk(audioUrl, startSeconds, chunkDuration);

        if (text.trim()) {
          segments.push({
            startMs: startSeconds * 1000,
            endMs: (startSeconds + chunkDuration) * 1000,
            text: text.trim(),
          });
        }

        await storage.updateEpisodeTranscript(transcriptId, {
          progress: i + 1,
          segments: JSON.stringify(segments),
        });
      } catch (err) {
        failedChunks++;
        console.error(`Error transcribing chunk ${i + 1}/${totalChunks}:`, err);
        await storage.updateEpisodeTranscript(transcriptId, {
          progress: i + 1,
          segments: JSON.stringify(segments),
        });

        if (failedChunks >= 3 && segments.length === 0) {
          await storage.updateEpisodeTranscript(transcriptId, {
            status: "error",
            errorMessage: "Too many transcription failures. The audio URL may be invalid or inaccessible.",
          });
          return;
        }
      }
    }

    if (segments.length === 0) {
      await storage.updateEpisodeTranscript(transcriptId, {
        status: "error",
        progress: totalChunks,
        errorMessage: "No transcript content was produced. The audio may be empty or unsupported.",
      });
      return;
    }

    await storage.updateEpisodeTranscript(transcriptId, {
      status: "completed",
      progress: totalChunks,
      segments: JSON.stringify(segments),
    });
  } catch (err) {
    console.error("Error in full episode transcription:", err);
    await storage.updateEpisodeTranscript(transcriptId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Unknown error during transcription",
    });
  }
}
