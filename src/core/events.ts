export const CHAT_EVENTS = {
  // Lifecycle of a single turn
  TURN_START: 'chat:turn:start',
  TURN_END: 'chat:turn:end',

  // Voice recording
  RECORDING_START: 'chat:recording:start',
  RECORDING_STOP: 'chat:recording:stop',
  RECORDING_CANCEL: 'chat:recording:cancel',
  
  // Speech-to-Text
  STT_START: 'chat:stt:start',
  STT_PARTIAL: 'chat:stt:partial',
  STT_COMPLETE: 'chat:stt:complete',
  STT_ERROR: 'chat:stt:error',

  // Language Model
  LLM_START: 'chat:llm:start',
  LLM_CHUNK: 'chat:llm:chunk',
  LLM_COMPLETE: 'chat:llm:complete',
  LLM_ERROR: 'chat:llm:error',

  // Text-to-Speech
  TTS_START: 'chat:tts:start',
  TTS_AUDIO_PLAYING: 'chat:tts:playing',
  TTS_AUDIO_PAUSED: 'chat:tts:paused',
  TTS_AUDIO_ENDED: 'chat:tts:ended',
  TTS_ERROR: 'chat:tts:error',

  // Message management
  MESSAGE_ADD: 'chat:message:add',
  MESSAGE_UPDATE: 'chat:message:update',
  MESSAGE_REMOVE: 'chat:message:remove',

  // Conversation state
  CONVERSATION_LOAD: 'chat:conversation:load',
  CONVERSATION_CLEAR: 'chat:conversation:clear',
  
  // Errors
  ERROR: 'chat:error',
};
