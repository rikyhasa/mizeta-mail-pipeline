export interface AttachmentStorage {
  put(key: string, content: Buffer | string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
