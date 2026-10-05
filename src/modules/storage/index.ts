import { getEnv } from "@/lib/env";
import { createLocalObjectStorage } from "@/modules/storage/local";
import { createS3ObjectStorage } from "@/modules/storage/s3";
import type { ObjectStorage } from "@/modules/storage/types";

let cached: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (cached) {
    return cached;
  }

  const env = getEnv();
  cached =
    env.STORAGE_PROVIDER === "s3"
      ? createS3ObjectStorage()
      : createLocalObjectStorage();
  return cached;
}

export function resetObjectStorageForTests() {
  cached = null;
}

export type { ObjectStorage, StoredObject } from "@/modules/storage/types";
