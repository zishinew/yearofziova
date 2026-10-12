import type { SupabaseClient } from "@supabase/supabase-js";

/** Direct storage uploads avoid application-server body limits. Larger files use TUS. */
export async function uploadStorageFile(client: SupabaseClient, bucket: string, path: string, file: File, contentType: string, onProgress: (message: string) => void) {
  if (!file.size) throw new Error("Choose a non-empty file.");
  if (file.size <= 6 * 1024 * 1024) {
    const { error } = await client.storage.from(bucket).upload(path, file, { contentType, upsert: false });
    if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);
    return;
  }
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session) throw new Error("Please sign in again before uploading.");
  const { Upload } = await import("tus-js-client");
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  endpoint.hostname = endpoint.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  endpoint.pathname = "/storage/v1/upload/resumable";
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: endpoint.toString(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "3600" },
      onBeforeRequest: async request => {
        // Refresh credentials during long uploads; Storage still validates authorization.
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error("Please sign in again before uploading.");
        request.setHeader("authorization", `Bearer ${data.session.access_token}`);
      },
      onProgress: (sent, total) => onProgress(`Uploading ${file.name}… ${Math.round(sent / total * 100)}%`),
      onError: problem => reject(new Error(`Couldn't upload ${file.name}: ${problem.message}`)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

/** Existing full WAVs remain private; RLS and signed URLs restrict source access. */
export async function storedBeatWav(client: SupabaseClient, id: string): Promise<File> {
  const { data, error } = await client.from("download_products").select("storage_path,download_name").eq("catalog_track_id", id).eq("lease", "wav").single();
  if (error || !data) throw new Error("Upload the original WAV to change this beat's preview.");
  const signed = await client.storage.from("purchased-beats").createSignedUrl(data.storage_path, 600);
  if (signed.error || !signed.data) throw new Error("Couldn't open the original WAV.");
  const response = await fetch(signed.data.signedUrl);
  if (!response.ok) throw new Error("Couldn't read the original WAV. Please try again.");
  return new File([await response.blob()], data.download_name, { type: "audio/wav" });
}
