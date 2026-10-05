import { validationError } from "@/modules/authorization/errors";
import { getEnv } from "@/lib/env";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

export function detectMimeFromBytes(buffer: Buffer): string | null {
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function validateUploadFile(input: {
  originalFilename: string;
  claimedMimeType?: string | null;
  content: Buffer;
}) {
  const env = getEnv();
  if (input.content.byteLength <= 0) {
    throw validationError("Uploaded file is empty");
  }

  if (input.content.byteLength > env.DOCUMENT_MAX_UPLOAD_BYTES) {
    throw validationError("This file exceeds the allowed size.");
  }

  const extension = input.originalFilename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw validationError(
      "This file type is not supported. Allowed: PDF, JPEG, PNG, WEBP.",
    );
  }

  const detected = detectMimeFromBytes(input.content);
  if (!detected) {
    throw validationError(
      "This file type is not supported. Upload a valid PDF or image.",
    );
  }

  const allowedForExt = MIME_BY_EXT[extension] ?? [];
  if (!allowedForExt.includes(detected)) {
    throw validationError(
      "This file type is not supported. File extension does not match contents.",
    );
  }

  if (
    input.claimedMimeType &&
    input.claimedMimeType !== "application/octet-stream" &&
    input.claimedMimeType !== detected
  ) {
    if (
      (input.claimedMimeType.startsWith("image/") ||
        input.claimedMimeType === "application/pdf") &&
      input.claimedMimeType !== detected
    ) {
      throw validationError(
        "This file type is not supported. Declared type does not match contents.",
      );
    }
  }

  return {
    mimeType: detected,
    extension,
    fileSize: input.content.byteLength,
  };
}

export function sanitizeFilename(filename: string) {
  const base = filename.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return base.slice(0, 180) || "document";
}
