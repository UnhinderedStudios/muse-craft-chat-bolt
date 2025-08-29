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

  // Initialize speech recognition for real-time transcription
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        // Don't process or show speech when we're playing TTS or shortly after to prevent self-recording
        if (isPlaying || postTTSTimeoutRef.current) {
          console.log('Ignoring speech during/after TTS playback');
          return;
        }

        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Accumulate final transcripts
            finalTranscriptRef.current += transcript + " ";
            console.log('Added final transcript:', transcript);
            console.log('Accumulated transcript:', finalTranscriptRef.current.trim());
          } else {
            interimTranscript += transcript;
          }
        }

        // Show current accumulated final + interim for UI feedback
        const displayTranscript = finalTranscriptRef.current.trim() + (interimTranscript ? " " + interimTranscript : "");
        setCurrentTranscript(displayTranscript);

        // Reset silence timeout on speech
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        // Set new silence timeout - only process if we have accumulated final transcript
        silenceTimeoutRef.current = setTimeout(async () => {
          const accumulatedTranscript = finalTranscriptRef.current.trim();
          if (accumulatedTranscript && accumulatedTranscript.length > 2) {
            console.log('Processing accumulated transcript from timeout:', accumulatedTranscript);
            
            // Process transcript directly here to avoid scope issues
            try {
              setIsProcessing(true);
              setCurrentTranscript(""); // Clear transcript
              console.log('Sending message to chat:', accumulatedTranscript);

              // Send message through the main chat system and get the AI response directly
              const aiResponse = await sendMessage(accumulatedTranscript, "You are a helpful voice assistant. Keep responses conversational and concise since they will be spoken aloud. Be engaging and natural in your speech.");

              console.log('AI response received:', aiResponse);
              console.log('AI response content:', aiResponse?.content);

              // Convert AI response to speech if we got a response
              if (aiResponse && aiResponse.content) {
                const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                  body: { 
                    text: aiResponse.content,
                    voice: 'alloy'
                  }
                });

                if (!ttsError && ttsData) {
                  await playAudio(ttsData.audioContent);
                } else {
                  console.error('Text-to-speech error:', ttsError);
                }
              } else {
                console.log('No AI response received');
              }

              setIsProcessing(false);

            } catch (error) {
              console.error('Error processing transcript:', error);
              console.error('Full error details:', JSON.stringify(error, null, 2));
              setIsProcessing(false);
              // Restart listening on error
              if (isAutoListeningRef.current) {
                setTimeout(() => startListening(), 500);
              }
            }
            
            finalTranscriptRef.current = ""; // Clear after processing
          }
        }, 2000); // 2 second pause
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current.onend = () => {
        if (isAutoListeningRef.current && !isProcessing && !isPlaying) {
          // Restart listening automatically after a brief pause
          setTimeout(() => {
            if (isAutoListeningRef.current && !isPlaying) {
              startListening();
            }
          }, 500);
        }
      };
    }
  }, [isProcessing, isPlaying, sendMessage]);

  const startListening = useCallback(async () => {
    try {
      // Don't start listening if we're playing TTS
      if (isPlaying) {
        console.log('Cannot start listening - TTS is playing');
        return;
      }

      console.log('Starting listening...');
      setIsListening(true);
      setIsRecording(true);
      setCurrentTranscript("");
      finalTranscriptRef.current = ""; // Clear accumulated transcript
      audioChunksRef.current = [];

      // Start speech recognition for real-time transcription
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.log('Speech recognition already started or error:', error);
        }
      }

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

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  }, [isPlaying]);

  // Create a simple stopRecording function that only stops recording
  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsRecording(false);
    setIsListening(false);
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    
    // Clean up media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);


  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      console.log('Starting TTS playback - disabling microphone');
      setIsPlaying(true);
      
      // Clear transcript display immediately when TTS starts
      setCurrentTranscript("");

      // Stop speech recognition completely during TTS to prevent self-recording
      if (recognitionRef.current) {
        console.log('Stopping speech recognition for TTS');
        recognitionRef.current.stop();
      }
      
      // Stop listening immediately when TTS starts to prevent self-recording
      if (isListening || isRecording) {
        stopRecording();
      }

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const audioBlob = new Blob([
        new Uint8Array(atob(base64Audio).split('').map(char => char.charCodeAt(0)))
      ], { type: 'audio/mp3' });

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      currentAudioRef.current = audio;
      audio.volume = isMuted ? 0 : volume;
      console.log('TTS audio volume initialized to:', audio.volume, '(muted:', isMuted, 'volume:', volume, ')');

      audio.onended = () => {
        console.log('TTS playback ended - can resume listening');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Clear any lingering transcript immediately when TTS ends
        setCurrentTranscript("");
        finalTranscriptRef.current = "";
        
        // Set a protection period to prevent transcript flash
        postTTSTimeoutRef.current = setTimeout(() => {
          postTTSTimeoutRef.current = null;
          console.log('Post-TTS protection period ended');
        }, 1500);
        
        // Automatically restart listening after TTS finishes with longer delay
        if (isAutoListeningRef.current) {
          setTimeout(() => {
            if (isAutoListeningRef.current && !isPlaying) {
              startListening();
            }
          }, 1000);
        }
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Restart listening on error too
        if (isAutoListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      
      // Restart listening on error
      if (isAutoListeningRef.current) {
        setTimeout(() => startListening(), 500);
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
    console.log('Stopping conversation - full cleanup');
    isAutoListeningRef.current = false;
    
    // Stop recording and listening
    stopRecording();
    setIsListening(false);
    setIsProcessing(false);
    
    // Stop any playing audio immediately
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(false);
    }

    // Clear all timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (postTTSTimeoutRef.current) {
      clearTimeout(postTTSTimeoutRef.current);
      postTTSTimeoutRef.current = null;
    }

    // Reset transcripts
    finalTranscriptRef.current = "";
    setCurrentTranscript("");
  }, [stopRecording]);

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
    startRecording: startConversation,
    stopRecording,
    stopConversation,
    toggleMute,
    setVolume: updateVolume
  };
};