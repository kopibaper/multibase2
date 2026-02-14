import { DockerManager } from './src/services/DockerManager';

async function main() {
  console.log('--- Debugging DockerManager ---');
  try {
    const dockerManager = new DockerManager();
    const isConnected = await dockerManager.ping();
    console.log(`Docker Connected: ${isConnected}`);

    if (isConnected) {
      // Check limit-test-1
      console.log('\nScanning limit-test-1...');
      const status1 = await dockerManager.getServiceStatus('limit-test-1');
      console.log('Result for limit-test-1:');
      console.log(JSON.stringify(status1, null, 2));

      // Check limit-test-3
      console.log('\nScanning limit-test-3...');
      const status3 = await dockerManager.getServiceStatus('limit-test-3');
      console.log('Result for limit-test-3:');
      console.log(JSON.stringify(status3, null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
