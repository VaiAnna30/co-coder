import api from './api';

export const executeCode = async (language, code, stdin = '') => {
  if (language === 'plaintext') {
    return {
      status: 'error',
      output: 'Cannot execute plain text.',
    };
  }

  try {
    const response = await api.post(`/code/execute`, {
      language,
      code,
      stdin
    });

    const data = response.data;
    
    return {
      status: 'success',
      output: data.output || 'No output generated.',
      executionTime: data.executionTime || 0,
    };
  } catch (error) {
    return {
      status: 'error',
      output: error.response?.data?.message || error.message || 'An error occurred during execution.',
    };
  }
};
