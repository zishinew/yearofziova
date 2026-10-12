/** Select up to 30 seconds without changing the full source audio. */
export function previewChannels(channels: Float32Array[], sampleRate: number, startSeconds = 0) {
  const length = channels[0]?.length || 0;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !length || channels.some(channel => channel.length !== length)) throw new Error("Invalid audio source.");
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds * sampleRate >= length) throw new Error("Preview start must be before the end of the beat.");
  const start = Math.floor(startSeconds * sampleRate);
  const end = Math.min(length, start + Math.round(30 * sampleRate));
  return channels.map(channel => channel.subarray(start, end));
}
