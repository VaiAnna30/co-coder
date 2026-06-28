const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const router = express.Router();

const EXECUTION_TIMEOUT = 20000; // 20 seconds max for free tier compilation

// Helper to run a command with timeout and stdin
const runCommand = (cmd, args, stdinData = '', cwd = null) => {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const startTime = Date.now();
    const proc = spawn(cmd, args, { cwd });

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

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

    // Kill process if it exceeds timeout
    const timeoutId = setTimeout(() => {
      proc.kill();
      reject({ message: 'Execution timed out (20s limit)' });
    }, EXECUTION_TIMEOUT);
  });
};

router.post('/execute', async (req, res) => {
  const { language, code, stdin = '' } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({ message: 'Language and code are required' });
  }

  // Create temporary directory for isolation
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
    } 
    else if (language === 'python') {
      const filePath = path.join(tempDir, 'script.py');
      await fs.writeFile(filePath, code);
      // Windows usually uses 'python', Linux uses 'python3'
      const cmd = process.platform === 'win32' ? 'python' : 'python3';
      const result = await runCommand(cmd, [filePath], stdin, tempDir);
      resultOutput = result.errorOutput ? result.errorOutput + '\n' + result.output : result.output;
      executionTime = result.executionTime;
    }
    else if (language === 'c' || language === 'cpp') {
      const ext = language === 'c' ? 'c' : 'cpp';
      const compiler = language === 'c' ? 'gcc' : 'g++';
      const filePath = path.join(tempDir, `main.${ext}`);
      const outName = process.platform === 'win32' ? 'main.exe' : 'main';
      const outPath = path.join(tempDir, outName);
      
      await fs.writeFile(filePath, code);
      
      // Compile
      const compileResult = await runCommand(compiler, [filePath, '-o', outPath], '', tempDir);
      if (compileResult.code !== 0) {
        throw new Error(`Compilation Error:\n${compileResult.errorOutput}`);
      }
      
      // Execute
      const execPath = process.platform === 'win32' ? outPath : `./${outName}`;
      const runResult = await runCommand(execPath, [], stdin, tempDir);
      resultOutput = runResult.errorOutput ? runResult.errorOutput + '\n' + runResult.output : runResult.output;
      executionTime = runResult.executionTime;
    }
    else if (language === 'java') {
      const filePath = path.join(tempDir, 'Main.java');
      await fs.writeFile(filePath, code);

      // Compile
      const compileResult = await runCommand('javac', ['Main.java'], '', tempDir);
      if (compileResult.code !== 0) {
        throw new Error(`Compilation Error:\n${compileResult.errorOutput}`);
      }
      
      // Execute
      const runResult = await runCommand('java', ['Main'], stdin, tempDir);
      resultOutput = runResult.errorOutput ? runResult.errorOutput + '\n' + runResult.output : runResult.output;
      executionTime = runResult.executionTime;
    }
    else {
      return res.status(400).json({ message: `Unsupported language: ${language}` });
    }

    res.json({
      output: resultOutput.trim() || 'No output generated.',
      executionTime
    });

  } catch (error) {
    console.error('Execution Error:', error);
    res.status(500).json({ message: error.message || 'Execution failed' });
  } finally {
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Failed to cleanup temp directory:', cleanupErr);
    }
  }
});

module.exports = router;
