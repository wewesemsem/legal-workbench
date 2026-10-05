import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "@/lib/env";
import type { ObjectStorage } from "@/modules/storage/types";

export function createLocalObjectStorage(): ObjectStorage {
  const root = path.resolve(getEnv().LOCAL_STORAGE_PATH);

  async function resolveKey(key: string) {
    const full = path.resolve(root, key);
    if (!full.startsWith(root)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  return {
    async putObject({ key, body, contentType }) {
      const full = await resolveKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      await writeFile(`${full}.meta.json`, JSON.stringify({ contentType }));
      return { key, size: body.byteLength, contentType };
    },

    async getObject(key) {
      const full = await resolveKey(key);
      const body = await readFile(full);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(
          await readFile(`${full}.meta.json`, "utf8"),
        ) as { contentType?: string };
        contentType = meta.contentType ?? contentType;
      } catch {
        // ignore missing meta
      }
      return { body, contentType };
    },

    async deleteObject(key) {
      const full = await resolveKey(key);
      await unlink(full).catch(() => undefined);
      await unlink(`${full}.meta.json`).catch(() => undefined);
    },
  };
}
