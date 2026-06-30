const express = require('express');
const crypto = require('crypto');
const { producer } = require('../config/kafka');
const router = express.Router();

router.post('/execute', async (req, res) => {
  const { language, code, stdin = '', roomCode, userId } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({ message: 'Language and code are required' });
  }

  const executionId = crypto.randomUUID();

  try {
    if (producer) {
      // 1. Publish the code execution request to Kafka
      await producer.send({
        topic: 'code-execution-requests',
        messages: [
          {
            key: executionId,
            value: JSON.stringify({
              executionId,
              language,
              code,
              stdin,
              roomCode,
              userId
            })
          }
        ]
      });

      // 2. Immediately respond to the HTTP request without waiting for execution
      res.json({
        message: 'Execution Pending... (Sent to isolated worker)',
        executionId
      });
    } else {
      res.status(503).json({ message: 'Code execution queue unavailable' });
    }
  } catch (error) {
    console.error('Execution Request Error:', error);
    res.status(500).json({ message: 'Failed to queue execution' });
  }
});

module.exports = router;
