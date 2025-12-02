// AudioWorkletProcessor for UniversalSTTRecorder
// Replaces deprecated ScriptProcessorNode

class UniversalSTTRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    // Handle messages from main thread if needed
    const { type, data } = event.data;
    if (type === 'configure') {
      // Store any configuration if needed
    }
  }

  process(inputs, outputs, parameters) {
    // Get the input audio buffer
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputData = input[0];

    // Create a copy of the audio data
    const audioData = new Float32Array(inputData.length);
    audioData.set(inputData);

    // Send the audio data to the main thread
    this.port.postMessage({
      type: 'audioData',
      data: audioData
    });

    return true;
  }
}

registerProcessor('universal-stt-recorder-processor', UniversalSTTRecorderProcessor);
