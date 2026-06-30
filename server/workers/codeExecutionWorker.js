const { Kafka } = require('kafkajs');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const EXECUTION_TIMEOUT = 20000;

// Setup Kafka for the Worker
const kafka = new Kafka({
  clientId: 'code-worker',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
});

const consumer = kafka.consumer({ groupId: 'code-execution-group' });
const producer = kafka.producer();

// Helper to run a command
const runCommand = (cmd, args, stdinData = '', cwd = null) => {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    const startTime = Date.now();
    
    // NOTE: In a true production environment, you would use Docker here:
    // const proc = spawn('docker', ['run', '--rm', '-i', '-v', `${cwd}:/app`, '-w', '/app', 'node:18', cmd, ...args]);
    const proc = spawn(cmd, args, { cwd });

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });

    proc.on('error', (err) => {
      reject({ message: `Failed to start ${cmd}: ${err.message}` });
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      resolve({ code, output, errorOutput, executionTime });
    });

    if (stdinData) {
      proc.stdin.write(stdinData);
    }
    proc.stdin.end();

    const timeoutId = setTimeout(() => {
      proc.kill();
      reject({ message: 'Execution timed out (20s limit)' });
    }, EXECUTION_TIMEOUT);
  });
};

const executeCode = async (language, code, stdin = '') => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cocode-'));
  let resultOutput = '';
  let executionTime = 0;

  try {
    if (language === 'javascript') {
      const filePath = path.join(tempDir, 'script.js');
      await fs.writeFile(filePath, code);
      const result = await runCommand('node', [filePath], stdin, tempDir);
      resultOutput = result.errorOutput ? result.errorOutput + '\n' + result.output : result.output;
      executionTime = result.executionTime;
    } else if (language === 'python') {
      const filePath = path.join(tempDir, 'script.py');
      await fs.writeFile(filePath, code);
      const cmd = process.platform === 'win32' ? 'python' : 'python3';
      const result = await runCommand(cmd, [filePath], stdin, tempDir);
      resultOutput = result.errorOutput ? result.errorOutput + '\n' + result.output : result.output;
      executionTime = result.executionTime;
    } else if (language === 'c' || language === 'cpp') {
      const ext = language === 'c' ? 'c' : 'cpp';
      const compiler = language === 'c' ? 'gcc' : 'g++';
      const filePath = path.join(tempDir, `main.${ext}`);
      const outName = process.platform === 'win32' ? 'main.exe' : 'main';
      const outPath = path.join(tempDir, outName);
      
      await fs.writeFile(filePath, code);
      const compileResult = await runCommand(compiler, [filePath, '-o', outPath], '', tempDir);
      if (compileResult.code !== 0) throw new Error(`Compilation Error:\n${compileResult.errorOutput}`);
      
      const execPath = process.platform === 'win32' ? outPath : `./${outName}`;
      const runResult = await runCommand(execPath, [], stdin, tempDir);
      resultOutput = runResult.errorOutput ? runResult.errorOutput + '\n' + runResult.output : runResult.output;
      executionTime = runResult.executionTime;
    } else if (language === 'java') {
      const filePath = path.join(tempDir, 'Main.java');
      await fs.writeFile(filePath, code);
      const compileResult = await runCommand('javac', ['Main.java'], '', tempDir);
      if (compileResult.code !== 0) throw new Error(`Compilation Error:\n${compileResult.errorOutput}`);
      
      const runResult = await runCommand('java', ['Main'], stdin, tempDir);
      resultOutput = runResult.errorOutput ? runResult.errorOutput + '\n' + runResult.output : runResult.output;
      executionTime = runResult.executionTime;
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }

    return { output: resultOutput.trim() || 'No output generated.', executionTime };
  } catch (error) {
    return { output: error.message || 'Execution failed', executionTime: 0, error: true };
  } finally {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
};

const startWorker = async () => {
  await producer.connect();
  await consumer.connect();
  console.log('👷‍♂️ Code Execution Worker Started & Connected to Kafka');
  
  await consumer.subscribe({ topic: 'code-execution-requests', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        const { executionId, language, code, stdin, roomCode, userId } = data;
        
        console.log(`Processing execution request ${executionId} for language: ${language}`);
        
        const result = await executeCode(language, code, stdin);
        
        // Publish result back to main server
        await producer.send({
          topic: 'code-execution-results',
          messages: [
            {
              value: JSON.stringify({
                executionId,
                roomCode,
                userId,
                output: result.output,
                executionTime: result.executionTime,
                isError: !!result.error
              })
            }
          ]
        });
        console.log(`Finished execution request ${executionId}`);
      } catch (err) {
        console.error('Error processing code message:', err);
      }
    },
  });
};

startWorker().catch(console.error);
