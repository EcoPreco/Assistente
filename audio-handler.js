const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const gtts = require('gtts');
const config = require('./config');

class AudioHandler {
  constructor() {
    this.audioDir = path.join(__dirname, 'temp_audio');
    this.ensureAudioDir();
  }

  ensureAudioDir() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  // Converter áudio para texto usando AssemblyAI
  async audioToText(audioBuffer, filename) {
    try {
      const audioPath = path.join(this.audioDir, filename);
      
      // Salvar áudio temporariamente
      await fs.writeFile(audioPath, audioBuffer);

      // Fazer upload do áudio para AssemblyAI
      const uploadResponse = await axios.post(
        `${config.ASSEMBLY_AI.BASE_URL}/upload`,
        fs.createReadStream(audioPath),
        {
          headers: {
            'authorization': config.ASSEMBLY_AI.API_KEY,
            'content-type': 'application/octet-stream'
          }
        }
      );

      const audioUrl = uploadResponse.data.upload_url;

      // Iniciar transcrição
      const transcriptionResponse = await axios.post(
        `${config.ASSEMBLY_AI.BASE_URL}/transcript`,
        {
          audio_url: audioUrl,
          language_code: 'pt'
        },
        {
          headers: {
            'authorization': config.ASSEMBLY_AI.API_KEY,
            'content-type': 'application/json'
          }
        }
      );

      const transcriptId = transcriptionResponse.data.id;

      // Aguardar até a transcrição estar pronta
      let transcriptResult;
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        transcriptResult = await axios.get(
          `${config.ASSEMBLY_AI.BASE_URL}/transcript/${transcriptId}`,
          {
            headers: {
              'authorization': config.ASSEMBLY_AI.API_KEY
            }
          }
        );

        if (transcriptResult.data.status === 'completed') {
          break;
        } else if (transcriptResult.data.status === 'error') {
          throw new Error(`Transcrição falhou: ${transcriptResult.data.error}`);
        }
      }

      await fs.remove(audioPath);
      return transcriptResult.data.text || 'Não foi possível transcrever o áudio';

    } catch (error) {
      console.error('Erro na transcrição de áudio:', error);
      throw new Error('Desculpe, não consegui entender o áudio. Pode digitar sua pergunta?');
    }
  }

  // Gerar áudio a partir de texto usando GTTS
  async textToAudio(text, filename = `response_${Date.now()}.mp3`) {
    return new Promise((resolve, reject) => {
      try {
        const audioPath = path.join(this.audioDir, filename);
        
        const gttsInstance = new gtts(text, 'pt-br');
        
        gttsInstance.save(audioPath, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(audioPath);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Limpar áudios temporários
  async cleanup() {
    try {
      const files = await fs.readdir(this.audioDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        const stat = await fs.stat(filePath);
        
        if (now - stat.mtimeMs > 5 * 60 * 1000) {
          await fs.remove(filePath);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar áudios temporários:', error);
    }
  }
}

module.exports = new AudioHandler();