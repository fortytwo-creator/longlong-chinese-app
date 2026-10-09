export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.recordedChunks = [];
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return true;
    } catch (e) {
      console.error('Audio context error:', e);
      return false;
    }
  }

  async playAudio(audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.volume = 1;
      await audio.play();
    } catch (e) {
      console.error('Play error:', e);
    }
  }

  async startRecording() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      const mediaRecorder = new MediaRecorder(this.mediaStream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      mediaRecorder.start();

      return {
        stop: async () => {
          return new Promise((resolve) => {
            mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
              resolve(blob);
            };
            mediaRecorder.stop();
            this.mediaStream.getTracks().forEach(t => t.stop());
          });
        }
      };
    } catch (e) {
      console.error('Recording error:', e);
      return null;
    }
  }
}

export const audioEngine = new AudioEngine();
