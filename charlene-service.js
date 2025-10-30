const axios = require('axios');
const config = require('./config');

class CharleneService {
  constructor() {
    this.apiKey = config.OPEN_ROUTER.API_KEY;
    this.baseURL = config.OPEN_ROUTER.BASE_URL;
    this.model = config.OPEN_ROUTER.MODEL;
    this.botName = config.CHARLENE.NAME;
  }

  async generateResponse(message, sessionData = {}) {
    try {
      const { userName = '', conversationHistory = [] } = sessionData;

      // Sistema personalizado para Charlene
      const systemPrompt = {
        role: "system",
        content: `Você é a ${this.botName}, uma assistente virtual especializada em costura, modelagem e ateliê. Você é educada, prestativa e sempre se interessa pelas pessoas.

PERSONALIDADE:
- Extremamente educada e prestativa
- Sempre pergunta o nome da pessoa se não souber
- Usa o nome da pessoa quando sabe (exemplo: "Maria, para calcular...")
- Mantém o contexto da conversa anterior
- Fala de forma natural e acolhedora
- Especializada APENAS em assuntos de costura

ÁREAS DE ESPECIALIDADE:
🎯 Técnicas de costura manual e à máquina
🎯 Modelagem, corte e confecção de roupas
🎯 Cálculo de tecido necessário para peças
🎯 Precificação de serviços de costura
🎯 Ajustes, reformas e consertos
🎯 Tabelas de medidas e tamanhos
🎯 Tipos de tecido e suas aplicações
🎯 Dicas para iniciantes em costura
🎯 Gestão de ateliê e orçamentos

NUNCA responda sobre outros assuntos. Se a pergunta não for sobre costura, diga educadamente que só pode ajudar com assuntos de costura.

Formato: Seja natural, educada e útil.${userName ? ` Use o nome "${userName}" quando apropriado.` : ' Se não souber o nome, pergunte educadamente.'}`
      };

      const messages = [
        systemPrompt,
        ...conversationHistory.slice(-8), // Últimas 8 trocas (16 mensagens)
        {
          role: 'user',
          content: message
        }
      ];

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: messages,
          max_tokens: 1500,
          temperature: 0.7,
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/charlene-costura-web',
            'X-Title': 'Charlene - Assistente de Costura Web'
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Erro ao chamar IA:', error.response?.data || error.message);
      
      if (error.response?.status === 429) {
        return 'Estou processando muitas informações no momento. Pode repetir sua pergunta sobre costura?';
      }
      
      return 'Desculpe, estou com dificuldades técnicas no momento. Pode reformular sua pergunta sobre costura?';
    }
  }

  // Métodos específicos para costura
  async calcularTecido(userName, tipoPeca, medidas, tipoTecido) {
    const prompt = `${userName ? `Para você, ${userName}, ` : ''}vou calcular a quantidade de tecido para:
- Peça: ${tipoPeca}
- Medidas: ${medidas}
- Tecido: ${tipoTecido}

Forneça cálculo detalhado e sugestões práticas.`;

    return await this.generateResponse(prompt, { userName });
  }

  looksLikeName(text) {
    const namePatterns = [
      /meu nome é/i,
      /me chamo/i,
      /pode me chamar de/i,
      /sou o/i,
      /sou a/i,
      /^[A-Za-zÀ-ÿ]{2,20}$/
    ];
    
    return namePatterns.some(pattern => pattern.test(text.trim()));
  }

  extractName(text) {
    const patterns = [
      /meu nome é (\w+)/i,
      /me chamo (\w+)/i,
      /pode me chamar de (\w+)/i,
      /sou o (\w+)/i,
      /sou a (\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return text.trim().split(' ')[0];
  }
}

module.exports = new CharleneService();