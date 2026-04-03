export type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface TestResult {
  success: boolean;
  test: string;
  data?: any;
  error?: any;
}

export interface TestStep {
  id: string;
  name: string;
  status: TestStatus;
  result?: TestResult;
}
