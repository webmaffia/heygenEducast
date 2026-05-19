/** Above this size, Chrome often hits net::ERR_NO_BUFFER_SPACE when decoding in the UI. */
export const AVATAR_PREVIEW_MAX_MB = 80;

export function isAvatarTooLargeForPreview(sizeMb?: number): boolean {
  return (sizeMb ?? 0) > AVATAR_PREVIEW_MAX_MB;
}

export function sizeMbFromBytes(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}
