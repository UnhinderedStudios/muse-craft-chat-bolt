import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceChatState {
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  volume: number;
  isListening: boolean;
  currentTranscript: string;
}

interface UseVoiceChatProps {
  messages: ChatMessage[];
  sendMessage: (message: string, systemPrompt: string, attachments?: any[]) => Promise<ChatMessage | null>;
}

export const useVoiceChat = ({ messages, sendMessage }: UseVoiceChatProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isAutoListeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);
  const postTTSTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOverlayActiveRef = useRef(true); // Track if overlay is active
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioOutputDetectionRef = useRef<boolean>(false);
  const cleanupCompleteRef = useRef(false);

  // Initialize speech recognition for real-time transcription
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        // Enhanced protection against self-recording
        if (isPlaying || postTTSTimeoutRef.current || audioOutputDetectionRef.current || !isOverlayActiveRef.current) {
          console.log('🚫 Ignoring speech - TTS playing:', isPlaying, 'Post-TTS timeout:', !!postTTSTimeoutRef.current, 'Audio output detected:', audioOutputDetectionRef.current);
          return;
        }

        let interimTranscript = '';
        let hasNewFinalTranscript = false;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          
          // Skip empty or very short transcripts
          if (transcript.length < 2) continue;
          
          if (event.results[i].isFinal) {
            // Prevent duplicate processing of same transcript
            if (!finalTranscriptRef.current.includes(transcript)) {
              finalTranscriptRef.current += transcript + " ";
              hasNewFinalTranscript = true;
              console.log('✅ Added final transcript:', transcript);
              console.log('📝 Accumulated transcript:', finalTranscriptRef.current.trim());
            }
          } else {
            interimTranscript += transcript;
          }
        }

        // Only update display if we have meaningful content
        if (hasNewFinalTranscript || interimTranscript) {
          const displayTranscript = finalTranscriptRef.current.trim() + (interimTranscript ? " " + interimTranscript : "");
          setCurrentTranscript(displayTranscript);
        }

        // Reset silence timeout on speech
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        // Set new silence timeout - only process if we have accumulated final transcript
        silenceTimeoutRef.current = setTimeout(async () => {
          const accumulatedTranscript = finalTranscriptRef.current.trim();
          
          // Enhanced validation and anti-loop protection
          if (!accumulatedTranscript || 
              accumulatedTranscript.length < 3 || 
              !isOverlayActiveRef.current ||
              isPlaying || 
              audioOutputDetectionRef.current) {
            console.log('🚫 Skipping transcript processing - invalid conditions');
            return;
          }

          console.log('🎯 Processing accumulated transcript:', accumulatedTranscript);
          
          try {
            // Clear transcript immediately to prevent reprocessing
            finalTranscriptRef.current = "";
            setCurrentTranscript("");
            setIsProcessing(true);
            
            // Stop all audio input during processing
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
            
            console.log('📤 Sending message to chat:', accumulatedTranscript);

            // Send message through the main chat system
            const aiResponse = await sendMessage(accumulatedTranscript, "You are a helpful voice assistant. Keep responses conversational and concise since they will be spoken aloud. Be engaging and natural in your speech.");

            console.log('🤖 AI response received:', aiResponse?.content);

            // Convert AI response to speech if we got a response
            if (aiResponse?.content && isOverlayActiveRef.current) {
              const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                body: { 
                  text: aiResponse.content,
                  voice: 'alloy'
                }
              });

              if (!ttsError && ttsData && isOverlayActiveRef.current) {
                await playAudio(ttsData.audioContent);
              } else {
                console.error('❌ Text-to-speech error:', ttsError);
              }
            }

            setIsProcessing(false);

          } catch (error) {
            console.error('❌ Error processing transcript:', error);
            setIsProcessing(false);
            finalTranscriptRef.current = ""; // Clear on error
            
            // Restart listening on error only if overlay is still active
            if (isAutoListeningRef.current && isOverlayActiveRef.current && !cleanupCompleteRef.current) {
              setTimeout(() => {
                if (isOverlayActiveRef.current && !cleanupCompleteRef.current) {
                  startListening();
                }
              }, 1000);
            }
          }
        }, 2500); // Longer pause to prevent rapid-fire processing
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current.onend = () => {
        console.log('🎤 Speech recognition ended');
        if (isAutoListeningRef.current && 
            !isProcessing && 
            !isPlaying && 
            !audioOutputDetectionRef.current &&
            isOverlayActiveRef.current && 
            !cleanupCompleteRef.current) {
          // Restart listening automatically after a brief pause
          setTimeout(() => {
            if (isAutoListeningRef.current && 
                !isPlaying && 
                !audioOutputDetectionRef.current &&
                isOverlayActiveRef.current && 
                !cleanupCompleteRef.current) {
              console.log('🔄 Auto-restarting speech recognition');
              startListening();
            }
          }, 800);
        }
      };
    }
  }, [isProcessing, isPlaying, sendMessage]);

  const startListening = useCallback(async () => {
    try {
      // Enhanced validation before starting
      if (isPlaying || audioOutputDetectionRef.current || !isOverlayActiveRef.current || cleanupCompleteRef.current) {
        console.log('🚫 Cannot start listening - conditions not met:', {
          isPlaying,
          audioOutputDetected: audioOutputDetectionRef.current,
          overlayActive: isOverlayActiveRef.current,
          cleanupComplete: cleanupCompleteRef.current
        });
        return;
      }

      console.log('🎤 Starting enhanced listening...');
      setIsListening(true);
      setIsRecording(true);
      setCurrentTranscript("");
      finalTranscriptRef.current = "";
      audioChunksRef.current = [];

      // Start speech recognition with enhanced error handling
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          console.log('✅ Speech recognition started');
        } catch (error) {
          console.log('⚠️ Speech recognition start error (might already be running):', error);
        }
      }

      // Get user media with enhanced audio settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Create audio context for output detection
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && !audioOutputDetectionRef.current) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('📹 MediaRecorder stopped');
        // Comprehensive cleanup of media stream
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Stopped media track:', track.kind);
          });
        }
        streamRef.current = null;
      };

      mediaRecorderRef.current.start(100);
      console.log('📹 MediaRecorder started');
      
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  }, [isPlaying]);

  // Enhanced stopRecording with comprehensive cleanup
  const stopRecording = useCallback(() => {
    console.log('🛑 Enhanced stopping recording...');
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.log('⚠️ Error stopping media recorder:', error);
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort(); // Force abort for immediate stop
      } catch (error) {
        console.log('⚠️ Error stopping recognition:', error);
      }
    }
    
    // Comprehensive media stream cleanup
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Force stopped track:', track.kind, 'State:', track.readyState);
      });
      streamRef.current = null;
    }

    // Reset all state
    setIsRecording(false);
    setIsListening(false);
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    audioOutputDetectionRef.current = false;
    
    // Clear all timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    console.log('✅ Recording cleanup complete');
  }, []);


  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      console.log('🔊 Starting enhanced TTS playback');
      
      // Immediate protection setup
      audioOutputDetectionRef.current = true;
      setIsPlaying(true);
      setCurrentTranscript("");
      finalTranscriptRef.current = "";

      // Aggressive stop of all input systems
      if (recognitionRef.current) {
        console.log('🛑 Force stopping speech recognition for TTS');
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (error) {
          console.log('⚠️ Error stopping recognition:', error);
        }
      }
      
      // Complete recording shutdown
      if (isListening || isRecording) {
        stopRecording();
      }

      // Aggressive cleanup of existing audio
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
          currentAudioRef.current.src = '';
          currentAudioRef.current.load();
        } catch (error) {
          console.log('⚠️ Error cleaning up previous audio:', error);
        }
        currentAudioRef.current = null;
      }

      // Early exit if overlay closed during setup
      if (!isOverlayActiveRef.current || cleanupCompleteRef.current) {
        console.log('🚫 Overlay closed during TTS setup, aborting');
        audioOutputDetectionRef.current = false;
        setIsPlaying(false);
        return;
      }

      const audioBlob = new Blob([
        new Uint8Array(atob(base64Audio).split('').map(char => char.charCodeAt(0)))
      ], { type: 'audio/mp3' });

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      currentAudioRef.current = audio;
      audio.volume = isMuted ? 0 : volume;
      console.log('🔊 TTS audio initialized, volume:', audio.volume);

      audio.onended = () => {
        console.log('✅ TTS playback ended');
        setIsPlaying(false);
        audioOutputDetectionRef.current = false;
        
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (error) {
          console.log('⚠️ Error revoking audio URL:', error);
        }
        
        currentAudioRef.current = null;
        
        // Extended protection period
        postTTSTimeoutRef.current = setTimeout(() => {
          postTTSTimeoutRef.current = null;
          console.log('🛡️ Post-TTS protection period ended');
        }, 2000);
        
        // Restart listening only if overlay still active
        if (isAutoListeningRef.current && isOverlayActiveRef.current && !cleanupCompleteRef.current) {
          setTimeout(() => {
            if (isAutoListeningRef.current && 
                !isPlaying && 
                isOverlayActiveRef.current && 
                !cleanupCompleteRef.current) {
              console.log('🔄 Restarting listening after TTS');
              startListening();
            }
          }, 1500);
        }
      };

      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        setIsPlaying(false);
        audioOutputDetectionRef.current = false;
        
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (e) {
          console.log('⚠️ Error revoking URL on error:', e);
        }
        
        currentAudioRef.current = null;
        
        // Restart listening on error if overlay still active
        if (isAutoListeningRef.current && isOverlayActiveRef.current && !cleanupCompleteRef.current) {
          setTimeout(() => {
            if (isOverlayActiveRef.current && !cleanupCompleteRef.current) {
              startListening();
            }
          }, 1000);
        }
      };

      // Additional check before playing
      if (isOverlayActiveRef.current && !cleanupCompleteRef.current) {
        await audio.play();
        console.log('🎵 TTS playback started');
      } else {
        console.log('🚫 Overlay closed, skipping audio play');
        setIsPlaying(false);
        audioOutputDetectionRef.current = false;
        URL.revokeObjectURL(audioUrl);
      }
      
    } catch (error) {
      console.error('❌ Error in TTS playback:', error);
      setIsPlaying(false);
      audioOutputDetectionRef.current = false;
      
      // Restart listening on error if conditions allow
      if (isAutoListeningRef.current && isOverlayActiveRef.current && !cleanupCompleteRef.current) {
        setTimeout(() => {
          if (isOverlayActiveRef.current && !cleanupCompleteRef.current) {
            startListening();
          }
        }, 1000);
      }
    }
  }, [volume, isMuted, isListening, isRecording, stopRecording, startListening]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMutedState = !prev;
      console.log('Toggle mute - new state:', newMutedState);
      if (currentAudioRef.current) {
        currentAudioRef.current.volume = newMutedState ? 0 : volume;
        console.log('Audio volume set to:', currentAudioRef.current.volume);
      }
      return newMutedState;
    });
  }, [volume]);

  const startConversation = useCallback(() => {
    isAutoListeningRef.current = true;
    startListening();
  }, [startListening]);

  const stopConversation = useCallback(() => {
    console.log('🛑 EMERGENCY STOP - Complete conversation cleanup');
    
    // Mark cleanup as in progress
    cleanupCompleteRef.current = true;
    isAutoListeningRef.current = false;
    isOverlayActiveRef.current = false;
    audioOutputDetectionRef.current = false;
    
    // Immediate state reset
    setIsListening(false);
    setIsProcessing(false);
    setIsRecording(false);
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    
    // Aggressive audio cleanup
    if (currentAudioRef.current) {
      try {
        // Remove ALL event listeners
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.onloadeddata = null;
        currentAudioRef.current.oncanplay = null;
        currentAudioRef.current.onplay = null;
        currentAudioRef.current.onpause = null;
        
        // Force immediate stop
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
        currentAudioRef.current.remove(); // Remove from DOM if attached
      } catch (error) {
        console.log('⚠️ Error during audio cleanup:', error);
      }
      currentAudioRef.current = null;
      setIsPlaying(false);
    }

    // Force stop recording with enhanced cleanup
    stopRecording();

    // Force stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
        // Don't nullify as it might be reused
      } catch (error) {
        console.log('⚠️ Error stopping recognition in cleanup:', error);
      }
    }

    // Cleanup audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      } catch (error) {
        console.log('⚠️ Error closing audio context:', error);
      }
    }

    // Clear ALL timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (postTTSTimeoutRef.current) {
      clearTimeout(postTTSTimeoutRef.current);
      postTTSTimeoutRef.current = null;
    }

    console.log('✅ EMERGENCY CLEANUP COMPLETE');
  }, [stopRecording]);

  const startConversationAgain = useCallback(() => {
    console.log('🔄 Restarting conversation');
    cleanupCompleteRef.current = false;
    isOverlayActiveRef.current = true;
    audioOutputDetectionRef.current = false;
    startConversation();
  }, [startConversation]);

  // Update volume when it changes
  const updateVolume = useCallback((newVolume: number) => {
    console.log('Volume updated to:', newVolume, '(muted:', isMuted, ')');
    setVolume(newVolume);
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = isMuted ? 0 : newVolume;
      console.log('Audio element volume set to:', currentAudioRef.current.volume);
    }
  }, [isMuted]);


  return {
    isRecording,
    isPlaying,
    isProcessing,
    isMuted,
    volume,
    isListening,
    currentTranscript,
    startRecording: startConversationAgain,
    stopRecording,
    stopConversation,
    toggleMute,
    setVolume: updateVolume
  };
};