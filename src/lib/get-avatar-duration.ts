import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';

function framesFromSeconds(durationInSeconds: number | null | undefined): number | null {
  if (
    durationInSeconds &&
    Number.isFinite(durationInSeconds) &&
    durationInSeconds > 0
  ) {
    return Math.max(1, Math.ceil(durationInSeconds * 30));
  }
  return null;
}

/** Read avatar duration from a HeyGen (or other remote) URL. */
export async function getAvatarDurationFromUrl(
  url: string,
): Promise<number | null> {
  try {
    const { durationInSeconds } = await parseMedia({
      src: url,
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    return framesFromSeconds(durationInSeconds);
  } catch {
    return null;
  }
}

/** Read avatar duration from disk (works for large local .webm files). */
export async function getAvatarDurationInFrames(
  filePath: string,
): Promise<number | null> {
  try {
    const { durationInSeconds } = await parseMedia({
      src: filePath,
      reader: nodeReader,
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    return framesFromSeconds(durationInSeconds);
  } catch {
    return null;
  }
}
