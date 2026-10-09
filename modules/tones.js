export class TonesLesson {
  constructor() {
    this.tones = [
      { id: 1, name: 'mā', pinyin: '妈', english: 'Mother', color: '#ff6b9d', example: '妈 (mamma)' },
      { id: 2, name: 'má', pinyin: '麻', english: 'Hemp', color: '#ffa500', example: '麻 (canapa)' },
      { id: 3, name: 'mǎ', pinyin: '马', english: 'Horse', color: '#52c41a', example: '马 (cavallo)' },
      { id: 4, name: 'mà', pinyin: '骂', english: 'Scold', color: '#1890ff', example: '骂 (rimproverare)' }
    ];
    this.tips = {
      1: ['Tono alto e piatto', 'Mantieni la voce stabile', 'Non alzare o abbassare il tono'],
      2: ['Tono ascendente', 'Inizia al centro e sali', 'Come se stessi chiedendo'],
      3: ['Tono discendente-ascendente', 'Inizia basso, scendi, poi sali', 'Il più difficile'],
      4: ['Tono discendente', 'Inizia alto e scendi', 'Come un comando']
    };
  }

  getTones() {
    return this.tones;
  }

  getToneTips(toneId) {
    return this.tips[toneId] || [];
  }

  async startTonePractice(toneId) {
    const tone = this.tones[toneId - 1];
    return tone;
  }

  async recordToneAttempt() {
    // Importa dinamicamente per evitare circular dependency
    const { audioEngine } = await import('./audio.js');
    return await audioEngine.startRecording();
  }

  getCompletionPercentage() {
    return 25;
  }
}

export const tonesLesson = new TonesLesson();
