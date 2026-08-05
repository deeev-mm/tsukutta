import type { Env } from "./crypto";

const UPLOAD_TRANSFORMATION = "c_limit,f_webp,h_1200,q_auto,w_1200";
const DELIVERY_FORMAT = "webp";

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloudinary の public_id からCDN配信URLを組み立てる（アップロード時に常にwebpへ変換している前提） */
export function cloudinaryDeliveryUrl(env: Env, publicId: string): string {
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}.${DELIVERY_FORMAT}`;
}

/**
 * 画像をCloudinaryへアップロードする(リサイズ+WebP変換込み)。
 * public_id を固定して呼ぶことで、同一レシピの再アップロード時に上書きされる。
 */
export async function uploadImage(
  env: Env,
  publicId: string,
  file: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = {
    overwrite: "true",
    public_id: publicId,
    timestamp,
    transformation: UPLOAD_TRANSFORMATION,
  };
  const signString =
    Object.keys(paramsToSign)
      .sort()
      .map((k) => `${k}=${paramsToSign[k as keyof typeof paramsToSign]}`)
      .join("&") + env.CLOUDINARY_API_SECRET;
  const signature = await sha1Hex(signString);

  const form = new FormData();
  form.set("file", new Blob([file], { type: contentType }));
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", "true");
  form.set("transformation", UPLOAD_TRANSFORMATION);
  form.set("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${body}`);
  }
}

/** public_id で画像を削除する。存在しない場合もCloudinary側は成功を返すため呼び出し側での存在確認は不要。 */
export async function deleteImage(env: Env, publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signString = `public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = await sha1Hex(signString);

  const form = new FormData();
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: "POST",
    body: form,
  });
}
