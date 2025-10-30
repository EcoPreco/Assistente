module.exports = {
  // Configuração do Open Router com DeepSeek
  OPEN_ROUTER: {
    API_KEY: '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',
    BASE_URL: 'https://openrouter.ai/api/v1',
    MODEL: 'deepseek/deepseek-r1-0528-qwen3-8b:free'
  },
  
  // Configuração do AssemblyAI
  ASSEMBLY_AI: {
    API_KEY: '42cd427a6f3949ec9578412edf5c9bee',
    BASE_URL: 'https://api.assemblyai.com/v2'
  },
  
  // Configuração do servidor
  SERVER: {
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '0.0.0.0'
  },
  
  // Configuração da Charlene
  CHARLENE: {
    NAME: 'Charlene',
    WELCOME_MESSAGE: 'Olá! Eu sou a Charlene, sua assistente virtual especializada em costura! Como posso ajudar você hoje?'
  }
};