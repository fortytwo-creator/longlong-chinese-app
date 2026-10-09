export class APIManager {
  constructor() {
    this.geminiKey = null;
    this.azureSpeechKey = null;
    this.azureRegion = 'eastus';
    this.audioCache = new Map();
  }

  setApiKeys(gemini, googleTts, azureSpeech, azureRegion) {
    this.geminiKey = gemini;
    this.azureSpeechKey = azureSpeech;
    this.azureRegion = azureRegion;
  }

  async synthesizeSpeech(text, language = 'zh-CN', gender = 'FEMALE') {
    const cacheKey = `${text}-${language}-${gender}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey);
    }

    try {
      const voiceMap = {
        'zh-CN': {
          'FEMALE': 'zh-CN-XiaoxiaoNeural',
          'MALE': 'zh-CN-YunxiNeural'
        }
      };

      const voiceName = voiceMap[language]?.[gender] || 'zh-CN-XiaoxiaoNeural';

      const ssml = `<speak version='1.0' xml:lang='${language}'>
        <voice name='${voiceName}'>
          <prosody pitch='0%' rate='0.9'>
            ${this._escapeXml(text)}
          </prosody>
        </voice>
      </speak>`;

      const response = await fetch(
        `https://${this.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureSpeechKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
          },
          body: ssml
        }
      );

      if (!response.ok) {
        console.warn('[API] Azure TTS error:', response.status);
        return this._getFallbackAudio();
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      this.audioCache.set(cacheKey, audioUrl);
      return audioUrl;
    } catch (e) {
      console.error('[API] TTS error:', e);
      return this._getFallbackAudio();
    }
  }

  _escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _getFallbackAudio() {
    return 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
  }
}

export const api = new APIManager();
