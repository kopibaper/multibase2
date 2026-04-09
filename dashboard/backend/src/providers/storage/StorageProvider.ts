export interface TestResult {
  success: boolean;
  error?: string;
}

export interface StorageProvider {
  upload(localPath: string, remotePath: string): Promise<void>;
  testConnection(): Promise<TestResult>;
}
