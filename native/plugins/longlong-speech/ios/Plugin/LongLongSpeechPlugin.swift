import Foundation
import Capacitor
import AVFoundation
import Speech

/// Microfono nativo (campioni grezzi, senza filtri) + riconoscimento vocale di Apple per il cinese.
/// JS: Capacitor.Plugins.LongLongSpeech.{requestPermissions,isAvailable,startRecording,stopRecording,recognize}
/// L'audio passa da/verso JS come Float32 little-endian in base64, mono, alla frequenza reale del microfono.
@objc(LongLongSpeechPlugin)
public class LongLongSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LongLongSpeechPlugin"
    public let jsName = "LongLongSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var samples = [Float]()
    private var sampleRate: Double = 48000
    private var recording = false
    private let lock = NSLock()

    private var recognizer: SFSpeechRecognizer?
    private var task: SFSpeechRecognitionTask?

    // MARK: permessi

    @objc func requestPermissions(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        session.requestRecordPermission { micOK in
            SFSpeechRecognizer.requestAuthorization { status in
                call.resolve(["mic": micOK, "speech": status == .authorized])
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let loc = Locale(identifier: call.getString("locale") ?? "zh-CN")
        let r = SFSpeechRecognizer(locale: loc)
        call.resolve([
            "available": r?.isAvailable ?? false,
            "onDevice": r?.supportsOnDeviceRecognition ?? false,
            "authorized": SFSpeechRecognizer.authorizationStatus() == .authorized
        ])
    }

    // MARK: registrazione

    @objc func startRecording(_ call: CAPPluginCall) {
        if recording { call.resolve(["sampleRate": sampleRate]); return }
        do {
            let session = AVAudioSession.sharedInstance()
            // .measurement = niente controllo automatico del volume né filtri: serve per misurare l'altezza della voce
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: [])
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            sampleRate = format.sampleRate
            lock.lock(); samples.removeAll(keepingCapacity: true); lock.unlock()
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
                guard let self = self, let ch = buffer.floatChannelData else { return }
                let n = Int(buffer.frameLength)
                let p = UnsafeBufferPointer(start: ch[0], count: n)
                self.lock.lock(); self.samples.append(contentsOf: p); self.lock.unlock()
            }
            engine.prepare()
            try engine.start()
            recording = true
            call.resolve(["sampleRate": sampleRate])
        } catch {
            call.reject("Microfono non disponibile: \(error.localizedDescription)")
        }
    }

    @objc func stopRecording(_ call: CAPPluginCall) {
        if recording {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
            recording = false
        }
        lock.lock(); let copy = samples; samples.removeAll(); lock.unlock()
        let data = copy.withUnsafeBufferPointer { Data(buffer: $0) }
        call.resolve(["audio": data.base64EncodedString(), "sampleRate": sampleRate, "count": copy.count])
    }

    // MARK: riconoscimento

    @objc func recognize(_ call: CAPPluginCall) {
        guard let b64 = call.getString("audio"), let data = Data(base64Encoded: b64), data.count >= 4 else {
            call.reject("audio mancante"); return
        }
        let sr = call.getDouble("sampleRate") ?? 48000
        let loc = Locale(identifier: call.getString("locale") ?? "zh-CN")
        guard let rec = SFSpeechRecognizer(locale: loc), rec.isAvailable else {
            call.reject("Riconoscimento vocale non disponibile"); return
        }
        let count = data.count / MemoryLayout<Float>.size
        guard let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sr, channels: 1, interleaved: false),
              let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(count)),
              let dst = buf.floatChannelData?[0] else {
            call.reject("formato audio non valido"); return
        }
        buf.frameLength = AVAudioFrameCount(count)
        data.withUnsafeBytes { raw in
            if let base = raw.baseAddress { memcpy(dst, base, count * MemoryLayout<Float>.size) }
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = false
        if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
        // Di proposito NON si passa la parola attesa come suggerimento: Apple la "correggerebbe" anche se detta male.
        if let ctx = call.getArray("contexts", String.self), !ctx.isEmpty { req.contextualStrings = ctx }
        req.append(buf)
        req.endAudio()

        recognizer = rec
        var finished = false
        let finish: (PluginCallResultData) -> Void = { [weak self] out in
            DispatchQueue.main.async {
                if finished { return }
                finished = true
                self?.task?.cancel(); self?.task = nil
                call.resolve(out)
            }
        }
        task = rec.recognitionTask(with: req) { result, error in
            if let r = result, r.isFinal {
                let alts: [[String: Any]] = r.transcriptions.prefix(5).map { t in
                    let conf = t.segments.isEmpty ? 0 : t.segments.map { Double($0.confidence) }.reduce(0, +) / Double(t.segments.count)
                    return ["text": t.formattedString, "confidence": conf]
                }
                finish(["text": r.bestTranscription.formattedString, "alternatives": alts, "onDevice": rec.supportsOnDeviceRecognition])
            } else if let e = error {
                // "nessun parlato rilevato" ecc.: non è un errore per l'app, solo testo vuoto
                finish(["text": "", "alternatives": [], "error": e.localizedDescription])
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { finish(["text": "", "alternatives": [], "error": "timeout"]) }
    }
}
