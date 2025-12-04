import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { BeatsNavigation } from '@/components/navigation/BeatsNavigation';

interface ToneSource {
  id: string;
  label: string;
  frequency: number;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  oscillator: OscillatorNode | null;
  gainNode: GainNode | null;
  pannerNode: StereoPannerNode | null;
}

interface AudioLayer {
  id: string;
  label: string;
  volume: number;
  isMuted: boolean;
  audioElement: HTMLAudioElement | null;
  gainNode: GainNode | null;
}

const PLANETARY_FREQUENCIES = [
  { name: 'Earth (OM)', hz: 136.10 },
  { name: 'Moon', hz: 210.42 },
  { name: 'Sun', hz: 126.22 },
  { name: 'Mercury', hz: 141.27 },
  { name: 'Venus', hz: 221.23 },
  { name: 'Mars', hz: 144.72 },
  { name: 'Jupiter', hz: 183.58 },
  { name: 'Saturn', hz: 147.85 },
  { name: 'Uranus', hz: 207.36 },
  { name: 'Neptune', hz: 211.44 },
  { name: 'Pluto', hz: 140.25 },
  { name: 'A4 (Standard)', hz: 440.00 },
  { name: 'A4 (432 Hz)', hz: 432.00 },
];

export default function Beats() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [brainwaveType, setBrainwaveType] = useState<'delta' | 'theta' | 'alpha' | 'beta' | 'gamma' | null>('alpha');
  const [centerFrequency, setCenterFrequency] = useState(136.10);
  
  // Track selected planet frequencies for left and right tones
  const [lowTonePlanet, setLowTonePlanet] = useState<number>(131.10);
  const [highTonePlanet, setHighTonePlanet] = useState<number>(141.10);
  
  // Initialize tones with alpha offset (136.10 - 5 = 131.10, 136.10 + 5 = 141.10)
  const [tones, setTones] = useState<ToneSource[]>([
    { id: 'low', label: 'Low Tone', frequency: 131.10, volume: 0.5, isMuted: false, isPlaying: false, oscillator: null, gainNode: null, pannerNode: null },
    { id: 'high', label: 'High Tone', frequency: 141.10, volume: 0.5, isMuted: false, isPlaying: false, oscillator: null, gainNode: null, pannerNode: null },
  ]);
  
  const [audioLayers, setAudioLayers] = useState<AudioLayer[]>([
    { id: 'layer1', label: 'Layer 1', volume: 0.5, isMuted: false, audioElement: null, gainNode: null },
    { id: 'layer2', label: 'Layer 2', volume: 0.5, isMuted: false, audioElement: null, gainNode: null },
  ]);

  const [actualFrequencies, setActualFrequencies] = useState<Record<string, number>>({});
  const recalibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context with maximum precision
  const initializeAudio = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000, // Standard high-quality sample rate
      });
      
      console.log('[Beats] Audio Context initialized');
      console.log('[Beats] Sample Rate:', ctx.sampleRate, 'Hz');
      console.log('[Beats] Base Latency:', ctx.baseLatency);
      console.log('[Beats] Output Latency:', ctx.outputLatency);
      
      setAudioContext(ctx);
      setIsInitialized(true);
    }
  };

  // Start/stop tone with frequency lock
  const toggleTone = (toneId: string) => {
    if (!audioContext) return;

    setTones(prev => prev.map(tone => {
      if (tone.id !== toneId) return tone;

      if (tone.isPlaying && tone.oscillator) {
        // Smooth fade-out to prevent click using scheduled exponential ramp
        if (tone.gainNode) {
          const now = audioContext.currentTime;
          const stopTime = now + 0.035; // ~35ms total fade time
          const currentGain = Math.max(0.0001, tone.gainNode.gain.value || 0.0001);
          tone.gainNode.gain.cancelScheduledValues(now);
          tone.gainNode.gain.setValueAtTime(currentGain, now);
          // Exponential ramp to near-zero avoids zero-crossing clicks
          tone.gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

          // Stop exactly at the end of the fade; cleanup on end
          try {
            tone.oscillator.onended = () => {
              try { tone.oscillator!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
              try { tone.gainNode!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
              try { tone.pannerNode!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
            };
            tone.oscillator.stop(stopTime);
          } catch {
            // Fallback in case stop scheduling fails
            setTimeout(() => {
              try { tone.oscillator!.stop(); } catch {
                // eslint-disable-next-line no-empty
              }
              try { tone.oscillator!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
              try { tone.gainNode!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
              try { tone.pannerNode!.disconnect(); } catch {
                // eslint-disable-next-line no-empty
              }
            }, 40);
          }
        }
        return { ...tone, isPlaying: false, oscillator: null, gainNode: null, pannerNode: null };
      } else {
        // Start tone with precise frequency and smooth fade-in
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const pannerNode = audioContext.createStereoPanner();
        
        // Pan left tone fully left (-1), right tone fully right (+1)
        const panValue = tone.id === 'low' ? -1 : 1;
        pannerNode.pan.setValueAtTime(panValue, audioContext.currentTime);
        
        oscillator.type = 'sine';
        // Use setValueAtTime for maximum precision instead of direct assignment
        oscillator.frequency.setValueAtTime(tone.frequency, audioContext.currentTime);
        
        // Smooth fade-in to prevent click/thump
        const targetVolume = tone.isMuted ? 0 : tone.volume;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.05); // 50ms fade-in
        
        // Connect: Oscillator -> Gain -> Panner -> Destination
        oscillator.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(audioContext.destination);
        
        oscillator.start();
        
        console.log(`[Beats] Started ${tone.label} at ${tone.frequency} Hz (pan: ${panValue}) (target precision: ±0.01 Hz)`);
        
        return { ...tone, isPlaying: true, oscillator, gainNode, pannerNode };
      }
    }));
  };

  // Update frequency with precision lock
  const updateFrequency = (toneId: string, newFrequency: number) => {
    setTones(prev => prev.map(tone => {
      if (tone.id !== toneId) return tone;
      
      // Update oscillator if playing
      if (tone.oscillator && tone.isPlaying) {
        tone.oscillator.frequency.setValueAtTime(newFrequency, audioContext!.currentTime);
      }
      
      return { ...tone, frequency: newFrequency };
    }));
  };


  // Toggle mute
  const toggleMute = (toneId: string) => {
    setTones(prev => prev.map(tone => {
      if (tone.id !== toneId) return tone;
      
      const newMuted = !tone.isMuted;
      if (tone.gainNode) {
        const targetVolume = newMuted ? 0 : tone.volume;
        // Smooth mute/unmute to prevent clicks
        tone.gainNode.gain.linearRampToValueAtTime(targetVolume, audioContext!.currentTime + 0.02);
      }
      
      return { ...tone, isMuted: newMuted };
    }));
  };

  // Apply preset frequency with brainwave offset
  const applyPresetWithBrainwave = (frequency: number, brainwave: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma' | null) => {
    let offset = 0;
    if (brainwave) {
      switch (brainwave) {
        case 'delta': offset = 1; break;  // 2 Hz beat
        case 'theta': offset = 3; break;   // 6 Hz beat
        case 'alpha': offset = 5; break;  // 10 Hz beat
        case 'beta': offset = 10; break;  // 20 Hz beat
        case 'gamma': offset = 20; break; // 40 Hz beat
      }
    }
    
    const lowFreq = frequency - offset;
    const highFreq = frequency + offset;
    
    setCenterFrequency(frequency);
    // Set both tone planets to the same preset frequency so they show the same selection
    setLowTonePlanet(frequency);
    setHighTonePlanet(frequency);
    updateFrequency('low', lowFreq);
    updateFrequency('high', highFreq);
  };

  // Handle audio file upload
  const handleAudioUpload = (layerId: string, file: File) => {
    if (!audioContext) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.loop = true;
    
    const source = audioContext.createMediaElementSource(audio);
    const gainNode = audioContext.createGain();
    
    setAudioLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;
      
      // Cleanup old audio
      if (layer.audioElement) {
        layer.audioElement.pause();
        layer.audioElement.src = '';
      }
      
      gainNode.gain.value = layer.isMuted ? 0 : layer.volume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      return { ...layer, audioElement: audio, gainNode };
    }));
  };

  // Toggle audio layer
  const toggleAudioLayer = (layerId: string) => {
    setAudioLayers(prev => prev.map(layer => {
      if (layer.id !== layerId || !layer.audioElement) return layer;
      
      if (layer.audioElement.paused) {
        // Smooth fade-in before play to avoid click
        if (layer.gainNode) {
          const now = audioContext!.currentTime;
          const target = layer.isMuted ? 0.0001 : Math.max(0.0001, layer.volume);
          layer.gainNode.gain.cancelScheduledValues(now);
          layer.gainNode.gain.setValueAtTime(0.0001, now);
          layer.gainNode.gain.exponentialRampToValueAtTime(target, now + 0.05);
        }
        layer.audioElement.play();
      } else {
        // Smooth fade-out then pause to avoid click
        if (layer.gainNode) {
          const now = audioContext!.currentTime;
          layer.gainNode.gain.cancelScheduledValues(now);
          const current = Math.max(0.0001, layer.gainNode.gain.value);
          layer.gainNode.gain.setValueAtTime(current, now);
          layer.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
          setTimeout(() => {
            try { layer.audioElement!.pause(); } catch {
              // eslint-disable-next-line no-empty
            }
          }, 35);
        } else {
          layer.audioElement.pause();
        }
      }
      
      return layer;
    }));
  };


  // Toggle audio layer mute (smooth)
  const toggleLayerMute = (layerId: string) => {
    setAudioLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;
      
      const newMuted = !layer.isMuted;
      if (layer.gainNode) {
        const now = audioContext!.currentTime;
        const target = newMuted ? 0 : layer.volume;
        layer.gainNode.gain.linearRampToValueAtTime(target, now + 0.02);
      }
      
      return { ...layer, isMuted: newMuted };
    }));
  };

  // Periodic frequency recalibration and monitoring (prevent drift)
  useEffect(() => {
    if (!audioContext) return;

    recalibrationIntervalRef.current = setInterval(() => {
      const frequencies: Record<string, number> = {};
      
      tones.forEach(tone => {
        if (tone.oscillator && tone.isPlaying) {
          // Lock frequency to target value with maximum precision
          tone.oscillator.frequency.setValueAtTime(tone.frequency, audioContext.currentTime);
          
          // Read back the actual frequency value
          const actualFreq = tone.oscillator.frequency.value;
          frequencies[tone.id] = actualFreq;
          
          // Check for drift and log warnings
          const drift = Math.abs(actualFreq - tone.frequency);
          if (drift > 0.1) {
            console.warn(`[Beats] Frequency drift detected on ${tone.label}: ${drift.toFixed(4)} Hz`);
          }
        }
      });
      
      setActualFrequencies(frequencies);
    }, 100); // Recalibrate every 100ms

    return () => {
      if (recalibrationIntervalRef.current) {
        clearInterval(recalibrationIntervalRef.current);
      }
    };
  }, [audioContext, tones]);

  // Auto-initialize audio on mount (may be blocked by browser, will retry on first interaction)
  useEffect(() => {
    initializeAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure audio context is ready before playing
  const ensureAudioReady = () => {
    if (!audioContext || audioContext.state === 'suspended') {
      initializeAudio();
      if (audioContext) {
        audioContext.resume();
      }
    }
  };

  // Cleanup on unmount
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    return () => {
      tones.forEach(tone => {
        if (tone.oscillator) {
          tone.oscillator.stop();
          tone.oscillator.disconnect();
        }
        if (tone.gainNode) tone.gainNode.disconnect();
        if (tone.pannerNode) tone.pannerNode.disconnect();
      });
      
      audioLayers.forEach(layer => {
        if (layer.audioElement) {
          layer.audioElement.pause();
          layer.audioElement.src = '';
        }
        if (layer.gainNode) layer.gainNode.disconnect();
      });
      
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

    return (
      <>
        <BeatsNavigation />
        <div className="min-h-screen bg-gray-50 py-8 md:py-16 px-4">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
         {/* Unified Binaural Mixer */}
         {isInitialized && (
           <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
             <div className="text-center mb-6 md:mb-10">
               <h2 className="text-2xl md:text-3xl font-light italic text-gray-900 tracking-tight">
                 Binaural Tone Mixer
               </h2>
               <p className="text-xs md:text-sm font-light text-gray-500 mt-2">
                 Craft precise binaural beats with planetary frequencies
               </p>
             </div>

             {/* Responsive Layout: Stack on mobile, 3 columns on desktop */}
             <div className="flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-8">
               
              {/* LEFT: Low Tone */}
              <div className="space-y-4 md:space-y-5 bg-gray-50 rounded-2xl p-5 md:p-6 border border-gray-100">
                <div className="flex items-center justify-center pb-3 border-b border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={!tones.find(t => t.id === 'low')?.isMuted}
                        onChange={() => toggleMute('low')}
                        className="w-6 h-6 md:w-5 md:h-5 rounded-md border-2 border-gray-300 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 transition-all"
                      />
                    </div>
                    <span className="text-lg md:text-base font-light text-gray-900 group-hover:text-gray-700 transition-colors">Left Tone</span>
                 </label>
               </div>

               {/* Planet Frequency Selector */}
               <div className="space-y-2">
                 <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Planet</div>
                 <select
                   value={lowTonePlanet}
                   onChange={(e) => {
                     const selectedHz = parseFloat(e.target.value);
                     if (!isNaN(selectedHz)) {
                       setLowTonePlanet(selectedHz);
                       updateFrequency('low', selectedHz);
                     }
                   }}
                   className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                 >
                   {PLANETARY_FREQUENCIES.map((preset) => (
                     <option key={preset.name} value={preset.hz}>
                       {preset.name}
                     </option>
                   ))}
                 </select>
               </div>

               {/* Frequency Input */}
                <div className="space-y-2">
                  <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Frequency</div>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="20000"
                    value={tones.find(t => t.id === 'low')?.frequency || 0}
                    onChange={(e) => {
                      const newFreq = parseFloat(e.target.value) || 0;
                      setLowTonePlanet(newFreq);
                      updateFrequency('low', newFreq);
                    }}
                    className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                  />
                  {tones.find(t => t.id === 'low')?.isPlaying && actualFrequencies['low'] && (
                   <div className="text-xs text-emerald-600 font-medium text-center tracking-wide mt-1">
                     ● {actualFrequencies['low'].toFixed(2)} Hz
                   </div>
                 )}
               </div>
             </div>

              {/* CENTER: Audio Upload Section */}
              <div className="space-y-5 md:space-y-6 px-0 md:px-2 order-last md:order-none">
                <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-5 md:p-6 border border-gray-100">
                  <div className="text-xs md:text-sm font-light text-gray-500 uppercase tracking-wide mb-4 text-center">Audio Layer</div>
                  
                  {/* Audio Upload */}
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && audioLayers[0]) {
                          handleAudioUpload('layer1', file);
                        }
                      }}
                      className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all hover:border-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-light file:bg-gray-900 file:text-white file:cursor-pointer"
                    />
                    
                    {/* Audio Controls */}
                    {audioLayers[0]?.audioElement && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toggleLayerMute('layer1')}
                            className="p-2.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            {audioLayers[0].isMuted ? (
                              <VolumeX className="w-5 h-5 md:w-4 md:h-4 text-gray-400" />
                            ) : (
                              <Volume2 className="w-5 h-5 md:w-4 md:h-4 text-gray-700" />
                            )}
                          </button>
                          <Button
                            onClick={() => toggleAudioLayer('layer1')}
                            variant={audioLayers[0].audioElement.paused ? "outline" : "default"}
                            size="sm"
                            className="rounded-full px-6 md:px-5 py-5 md:py-4 font-light"
                          >
                            {audioLayers[0].audioElement.paused ? (
                              <>
                                <Play className="w-4 h-4 md:w-3 md:h-3 mr-1.5" />
                                Play
                              </>
                            ) : (
                              <>
                                <Pause className="w-4 h-4 md:w-3 md:h-3 mr-1.5" />
                                Stop
                              </>
                            )}
                          </Button>
                        </div>
                     </div>
                   )}
                 </div>
                </div>

               {/* Brainwave Type Selector */}
               <div className="space-y-3">
                 <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Brainwave</div>
                 <select
                   value={brainwaveType || ''}
                  onChange={(e) => {
                    const newBrainwave = e.target.value === '' ? null : e.target.value as 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
                    setBrainwaveType(newBrainwave);
                    applyPresetWithBrainwave(centerFrequency, newBrainwave);
                  }}
                  className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                >
                  <option value="">None</option>
                  <option value="delta">Delta (2 Hz)</option>
                  <option value="theta">Theta (6 Hz)</option>
                  <option value="alpha">Alpha (10 Hz)</option>
                  <option value="beta">Beta (20 Hz)</option>
                  <option value="gamma">Gamma (40 Hz)</option>
                </select>
               </div>

               {/* Quick Presets */}
               <div className="space-y-3">
                 <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Preset</div>
                 <select
                   value={centerFrequency}
                   onChange={(e) => {
                     const selectedHz = parseFloat(e.target.value);
                     if (!isNaN(selectedHz)) {
                       setBrainwaveType(null); // Reset brainwave to null when preset is selected
                       applyPresetWithBrainwave(selectedHz, null);
                     }
                   }}
                   className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                 >
                   {PLANETARY_FREQUENCIES.map((preset) => (
                     <option key={preset.name} value={preset.hz}>
                       {preset.name}
                     </option>
                   ))}
                 </select>
               </div>
              </div>

              {/* RIGHT: High Tone */}
              <div className="space-y-4 md:space-y-5 bg-gray-50 rounded-2xl p-5 md:p-6 border border-gray-100">
                <div className="flex items-center justify-center pb-3 border-b border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={!tones.find(t => t.id === 'high')?.isMuted}
                        onChange={() => toggleMute('high')}
                        className="w-6 h-6 md:w-5 md:h-5 rounded-md border-2 border-gray-300 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 transition-all"
                      />
                    </div>
                    <span className="text-lg md:text-base font-light text-gray-900 group-hover:text-gray-700 transition-colors">Right Tone</span>
                 </label>
               </div>

               {/* Planet Frequency Selector */}
               <div className="space-y-2">
                 <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Planet</div>
                 <select
                   value={highTonePlanet}
                   onChange={(e) => {
                     const selectedHz = parseFloat(e.target.value);
                     if (!isNaN(selectedHz)) {
                       setHighTonePlanet(selectedHz);
                       updateFrequency('high', selectedHz);
                     }
                   }}
                   className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                 >
                   {PLANETARY_FREQUENCIES.map((preset) => (
                     <option key={preset.name} value={preset.hz}>
                       {preset.name}
                     </option>
                   ))}
                 </select>
               </div>

               {/* Frequency Input */}
                <div className="space-y-2">
                  <div className="text-xs font-light text-gray-500 uppercase tracking-wide text-center">Frequency</div>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="20000"
                    value={tones.find(t => t.id === 'high')?.frequency || 0}
                    onChange={(e) => {
                      const newFreq = parseFloat(e.target.value) || 0;
                      setHighTonePlanet(newFreq);
                      updateFrequency('high', newFreq);
                    }}
                    className="w-full px-4 py-3.5 md:py-3 bg-white border border-gray-200 rounded-full font-light text-base md:text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all hover:border-gray-300"
                  />
                 {tones.find(t => t.id === 'high')?.isPlaying && actualFrequencies['high'] && (
                   <div className="text-xs text-emerald-600 font-medium text-center tracking-wide mt-1">
                     ● {actualFrequencies['high'].toFixed(2)} Hz
                   </div>
                 )}
               </div>
             </div>
             </div>

            {/* Bottom: Single Play/Stop Button */}
            <div className="mt-8 md:mt-10 flex justify-center px-4">
              <Button
                onClick={() => {
                  ensureAudioReady(); // Ensure audio context is ready
                  const hasPlaying = tones.some(t => t.isPlaying);
                  if (hasPlaying) {
                    // Stop all
                    tones.forEach(tone => {
                      if (tone.isPlaying) toggleTone(tone.id);
                    });
                  } else {
                    // Play only selected (unmuted) tones
                    tones.forEach(tone => {
                      if (!tone.isMuted) toggleTone(tone.id);
                    });
                  }
                }}
                variant={tones.some(t => t.isPlaying) ? "default" : "outline"}
                size="lg"
                className="w-full md:w-auto rounded-full px-10 md:px-12 py-7 md:py-6 text-base md:text-base font-light shadow-sm hover:shadow-md transition-all"
              >
                {tones.some(t => t.isPlaying) ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Stop Binaural Beat
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Binaural Beat
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
     </div>
   </div>
      </>
 );
}
