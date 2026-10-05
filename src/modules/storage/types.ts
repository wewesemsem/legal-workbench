export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export interface ObjectStorage {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject>;
  getObject(key: string): Promise<{ body: Buffer; contentType: string }>;
  deleteObject(key: string): Promise<void>;
}
