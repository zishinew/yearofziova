import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const source = await readFile(join(process.cwd(), "public/icon.png"));
  return new ImageResponse(
    // ImageResponse renders the original artwork at browser favicon size.
    <img src={`data:image/png;base64,${source.toString("base64")}`} alt="" width={32} height={32} />,
    size,
  );
}
