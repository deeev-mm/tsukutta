/**
 * スマホ写真に含まれがちな位置情報等のメタデータ(EXIF)をアップロード時に除去する。
 * 画像デコードは行わず、コンテナのメタデータセグメントだけをバイナリレベルで取り除く。
 */
export function stripImageMetadata(buf: ArrayBuffer, contentType: string): ArrayBuffer {
  if (contentType === "image/jpeg" || contentType === "image/jpg") {
    return stripJpegExif(buf);
  }
  if (contentType === "image/png") {
    return stripPngMetadata(buf);
  }
  return buf;
}

// JPEG: SOIの後に続くAPP1(EXIF)/APP13(Photoshop IPTC)セグメントを除去する。
function stripJpegExif(buf: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buf);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return buf;

  const out: number[] = [0xff, 0xd8];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];

    // SOS(スキャン開始)以降は画像データなのでそのままコピーして終了
    if (marker === 0xda) {
      for (let i = offset; i < bytes.length; i++) out.push(bytes[i]);
      break;
    }
    // マーカー単体(パディング等)はスキップ
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isMetadata = marker === 0xe1 /* APP1: EXIF/XMP */ || marker === 0xed; /* APP13: IPTC */

    if (!isMetadata) {
      for (let i = offset; i < offset + 2 + segmentLength; i++) out.push(bytes[i]);
    }
    offset += 2 + segmentLength;
  }

  return new Uint8Array(out).buffer;
}

// PNG: eXIf / tEXt / zTXt / iTXt / tIME 等の補助チャンクを除去する。
function stripPngMetadata(buf: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buf);
  const SIG_LEN = 8;
  if (bytes.length < SIG_LEN) return buf;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < SIG_LEN; i++) {
    if (bytes[i] !== signature[i]) return buf;
  }

  const stripTypes = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const out: number[] = [...signature];
  let offset = SIG_LEN;

  while (offset + 8 <= bytes.length) {
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const chunkTotalLength = 8 + length + 4; // length + type + data + crc

    if (!stripTypes.has(type)) {
      for (let i = offset; i < offset + chunkTotalLength; i++) out.push(bytes[i]);
    }
    offset += chunkTotalLength;
    if (type === "IEND") break;
  }

  return new Uint8Array(out).buffer;
}
