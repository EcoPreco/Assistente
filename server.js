const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const config = require('./config');
const charleneService = require('./charlene-service');
const audioHandler = require('./audio-handler');

const app = express();
const PORT = config.SERVER.PORT;
const HOST = config.SERVER.HOST;

// Configuração do multer para upload de áudio
const upload = multer({ 
  dest: 'temp_audio/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/audio', express.static('temp_audio'));

// Armazenamento em memória (em produção use Redis ou database)
const sessions = new Map();

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para obter sessão
app.get('/api/session', (req, res) => {
  const sessionId = req.query.sessionId || generateSessionId();
  
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      userName: '',
      conversationHistory: [],
      messageCount: 0,
      createdAt: Date.now()
    });
  }

  res.json({ 
    sessionId, 
    botName: config.CHARLENE.NAME,
    welcomeMessage: config.CHARLENE.WELCOME_MESSAGE
  });
});

// Rota para chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(400).json({ error: 'Sessão inválida' });
    }

    const session = sessions.get(sessionId);
    session.messageCount++;

    // Verificar se é primeira mensagem e pedir nome
    if (session.messageCount === 1 && !session.userName) {
      const welcomeResponse = {
        text: `👋 Olá! Eu sou a *${config.CHARLENE.NAME}*, sua assistente virtual especializada em costura!\n\nPara nossa conversa ser mais personalizada, qual é o seu nome? 😊`,
        userName: session.userName,
        isFirstMessage: true
      };
      return res.json(welcomeResponse);
    }

    // Tentar extrair nome se ainda não tem
    if (!session.userName && charleneService.looksLikeName(message)) {
      session.userName = charleneService.extractName(message);
      const nameResponse = {
        text: `Prazer em conhecê-la, *${session.userName}*! 😊\n\nAgora, como posso ajudar você com costura, modelagem ou seu ateliê?`,
        userName: session.userName,
        nameConfirmed: true
      };
      return res.json(nameResponse);
    }

    // Gerar resposta da Charlene
    const aiResponse = await charleneService.generateResponse(message, session);

    // Atualizar histórico
    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    );

    // Manter apenas últimas 8 trocas
    if (session.conversationHistory.length > 16) {
      session.conversationHistory.splice(0, 4);
    }

    res.json({
      text: aiResponse,
      userName: session.userName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no chat:', error);
    res.status(500).json({ 
      error: 'Desculpe, ocorreu um erro. Tente novamente.',
      text: '❌ Desculpe, tive um problema técnico. Pode repetir sua pergunta sobre costura?'
    });
  }
});

// Rota para upload de áudio
app.post('/api/audio-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
    }

    const { sessionId } = req.body;
    
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(400).json({ error: 'Sessão inválida' });
    }

    const audioBuffer = await fs.readFile(req.file.path);
    const transcription = await audioHandler.audioToText(audioBuffer, req.file.originalname);

    // Limpar arquivo temporário
    await fs.remove(req.file.path);

    res.json({ 
      text: transcription,
      success: true 
    });

  } catch (error) {
    console.error('Erro no processamento de áudio:', error);
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Rota para gerar áudio a partir do texto
app.get('/api/text-to-audio', async (req, res) => {
  try {
    const { text } = req.query;
    
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    // Limitar texto para áudio
    const textoLimitado = text.length > 300 ? text.substring(0, 300) + '...' : text;
    
    const audioPath = await audioHandler.textToAudio(textoLimitado);
    const filename = path.basename(audioPath);

    // Configurar para deletar arquivo após 5 minutos
    setTimeout(async () => {
      try {
        await fs.remove(audioPath);
      } catch (error) {
        console.error('Erro ao limpar áudio:', error);
      }
    }, 5 * 60 * 1000);

    res.json({ 
      audioUrl: `/audio/${filename}`,
      success: true 
    });

  } catch (error) {
    console.error('Erro na geração de áudio:', error);
    res.status(500).json({ 
      error: 'Erro ao gerar áudio',
      success: false 
    });
  }
});

// Rota para limpar sessão
app.post('/api/clear-session', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  
  res.json({ success: true });
});

// Função para gerar ID de sessão
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Limpeza periódica de sessões antigas
setInterval(() => {
  const now = Date.now();
  const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 horas
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > MAX_SESSION_AGE) {
      sessions.delete(sessionId);
    }
  }
  
  audioHandler.cleanup();
}, 60 * 60 * 1000); // A cada hora

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`
🧵 CHARLENE - ASSISTENTE DE COSTURA WEB 🧵
👋 Nome: ${config.CHARLENE.NAME}
🎯 Especialidade: Costura, Ateliê, Modelagem
🌐 Servidor: http://${HOST}:${PORT}
💬 Funcionalidades: Chat por texto e áudio
🤖 IA: DeepSeek R1 (Especializada em costura)
📱 Status: Online e aguardando conversas!

Características:
✅ Educada e prestativa
✅ Pede e lembra nomes
✅ Mantém contexto da conversa
✅ Suporte a áudio (entrada e saída)
✅ Interface web moderna
✅ Especializada apenas em costura
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n🔄 ${config.CHARLENE.NAME} se despedindo...`);
  await audioHandler.cleanup();
  process.exit(0);
});