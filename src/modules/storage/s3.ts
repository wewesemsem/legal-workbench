import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getEnv } from "@/lib/env";
import type { ObjectStorage } from "@/modules/storage/types";

let ensuredBucket = false;

export function createS3ObjectStorage(): ObjectStorage {
  const env = getEnv();
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  async function ensureBucket() {
    if (ensuredBucket) {
      return;
    }
    try {
      await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    }
    ensuredBucket = true;
  }

  return {
    async putObject({ key, body, contentType }) {
      await ensureBucket();
      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key, size: body.byteLength, contentType };
    },

    async getObject(key) {
      await ensureBucket();
      const result = await client.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
        }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) {
        throw new Error("Object not found");
      }
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    },

    async deleteObject(key) {
      await ensureBucket();
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
        }),
      );
    },
  };
}
