class CharleneChat {
    constructor() {
        this.sessionId = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        // Inicializar sessão
        await this.initializeSession();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Focar no input
        document.getElementById('messageInput').focus();
    }

    async initializeSession() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            this.sessionId = data.sessionId;
            console.log('Sessão inicializada:', this.sessionId);
            
        } catch (error) {
            console.error('Erro ao inicializar sessão:', error);
            this.showError('Erro ao conectar com o servidor');
        }
    }

    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const audioBtn = document.getElementById('audioBtn');
        const stopRecordingBtn = document.getElementById('stopRecording');

        // Enviar mensagem com Enter
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Enviar mensagem com botão
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Iniciar gravação de áudio
        audioBtn.addEventListener('click', () => {
            this.toggleAudioRecording();
        });

        // Parar gravação
        stopRecordingBtn.addEventListener('click', () => {
            this.stopAudioRecording();
        });

        // Permitir arrastar e soltar arquivo de áudio
        this.setupDragAndDrop();
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        // Adicionar mensagem do usuário ao chat
        this.addMessage(message, 'user');
        messageInput.value = '';

        // Mostrar indicador de digitação
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            // Remover indicador de digitação
            this.hideTypingIndicator();

            if (data.error) {
                this.addMessage(data.error, 'bot');
            } else {
                this.addMessage(data.text, 'bot');
                
                // Oferecer áudio da resposta
                this.offerAudioResponse(data.text);
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            this.hideTypingIndicator();
            this.addMessage('❌ Erro de conexão. Tente novamente.', 'bot');
        }
    }

    addMessage(text, sender) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'bot' ? '🧵' : '👤';

        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Processar quebras de linha e formatação simples
        const formattedText = text.replace(/\n/g, '<br>');
        content.innerHTML = formattedText;

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        chatMessages.appendChild(messageDiv);

        // Scroll para baixo
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message';
        typingDiv.id = 'typingIndicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '🧵';

        const content = document.createElement('div');
        content.className = 'message-content typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            content.appendChild(dot);
        }

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(content);
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async toggleAudioRecording() {
        if (this.isRecording) {
            this.stopAudioRecording();
        } else {
            await this.startAudioRecording();
        }
    }

    async startAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.sendAudioMessage(audioBlob);
                
                // Parar todas as tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateAudioUI(true);

        } catch (error) {
            console.error('Erro ao acessar microfone:', error);
            this.addMessage('❌ Não foi possível acessar o microfone. Verifique as permissões.', 'bot');
        }
    }

    stopAudioRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateAudioUI(false);
        }
    }

    updateAudioUI(recording) {
        const audioBtn = document.getElementById('audioBtn');
        const audioRecorder = document.getElementById('audioRecorder');

        if (recording) {
            audioBtn.classList.add('recording');
            audioRecorder.classList.remove('hidden');
        } else {
            audioBtn.classList.remove('recording');
            audioRecorder.classList.add('hidden');
        }
    }

    async sendAudioMessage(audioBlob) {
        this.showTypingIndicator();

        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');
        formData.append('sessionId', this.sessionId);

        try {
            // Transcrever áudio
            const transcribeResponse = await fetch('/api/audio-to-text', {
                method: 'POST',
                body: formData
            });

            const transcribeData = await transcribeResponse.json();

            this.hideTypingIndicator();

            if (transcribeData.success) {
                // Mostrar transcrição
                this.addMessage(`🎤 Áudio: "${transcribeData.text}"`, 'user');
                
                // Enviar transcrição como mensagem normal
                this.showTypingIndicator();
                
                const chatResponse = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: transcribeData.text,
                        sessionId: this.sessionId
                    })
                });

                const chatData = await chatResponse.json();
                this.hideTypingIndicator();

                if (chatData.error) {
                    this.addMessage(chatData.error, 'bot');
                } else {
                    this.addMessage(chatData.text, 'bot');
                    this.offerAudioResponse(chatData.text);
                }
            } else {
                this.addMessage(`❌ ${transcribeData.error}`, 'bot');
            }

        } catch (error) {
            console.error('Erro ao processar áudio:', error);
            this.hideTypingIndicator();
            this.addMessage('❌ Erro ao processar áudio. Tente novamente.', 'bot');
        }
    }

    async offerAudioResponse(text) {
        // Criar botão para ouvir resposta em áudio
        const chatMessages = document.getElementById('chatMessages');
        const lastBotMessage = chatMessages.lastChild;

        if (lastBotMessage && lastBotMessage.classList.contains('bot-message')) {
            const audioButton = document.createElement('div');
            audioButton.className = 'audio-message';
            audioButton.innerHTML = '🔊 Ouvir resposta em áudio';
            audioButton.onclick = () => this.playAudioResponse(text);

            lastBotMessage.querySelector('.message-content').appendChild(audioButton);
        }
    }

    async playAudioResponse(text) {
        try {
            const response = await fetch(`/api/text-to-audio?text=${encodeURIComponent(text)}`);
            const data = await response.json();

            if (data.success) {
                const audio = new Audio(data.audioUrl);
                audio.play().catch(error => {
                    console.error('Erro ao reproduzir áudio:', error);
                });
            } else {
                console.error('Erro ao gerar áudio:', data.error);
            }
        } catch (error) {
            console.error('Erro ao obter áudio:', error);
        }
    }

    setupDragAndDrop() {
        const chatContainer = document.querySelector('.chat-container');

        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatContainer.style.backgroundColor = '#F8FAFC';
        });

        chatContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            chatContainer.style.backgroundColor = '';
        });

        chatContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            chatContainer.style.backgroundColor = '';

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('audio/')) {
                this.sendAudioMessage(files[0]);
            }
        });
    }

    showError(message) {
        // Implementação simples de erro
        console.error(message);
        this.addMessage(`❌ ${message}`, 'bot');
    }
}

// Inicializar o chat quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new CharleneChat();
});