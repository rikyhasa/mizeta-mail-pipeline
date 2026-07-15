import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "@/lib/config/env";
import type { AttachmentStorage } from "@/lib/storage/types";

class LocalAttachmentStorage implements AttachmentStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async put(key: string, content: Buffer | string): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export const attachmentStorage: AttachmentStorage = new LocalAttachmentStorage(
  env.ATTACHMENT_STORAGE_LOCAL_DIR,
);
