import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceChatState {
  messages: ChatMessage[];
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  volume: number;
  isListening: boolean;
  currentTranscript: string;
}

export const useVoiceChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  // Initialize speech recognition for real-time transcription
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setCurrentTranscript(finalTranscript + interimTranscript);

        // Reset silence timeout on speech
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        // Set new silence timeout
        silenceTimeoutRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            stopRecording();
          }
        }, 2000); // 2 second pause
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current.onend = () => {
        if (isAutoListeningRef.current && !isProcessing && !isPlaying) {
          // Restart listening automatically
          setTimeout(() => startListening(), 500);
        }
      };
    }
  }, [isProcessing, isPlaying]);

  const startListening = useCallback(async () => {
    try {
      setIsListening(true);
      setIsRecording(true);
      setCurrentTranscript("");
      audioChunksRef.current = [];
      isAutoListeningRef.current = true;

      // Start speech recognition for real-time transcription
      if (recognitionRef.current) {
        recognitionRef.current.start();
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

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudio(audioBlob);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
      
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }
  }, [isRecording]);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      // Only process if we have a meaningful transcript
      const userText = currentTranscript.trim();
      if (!userText) {
        console.log('No speech detected');
        setIsProcessing(false);
        // Restart listening if no speech was detected
        if (isAutoListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
        return;
      }

      console.log('Processing transcript:', userText);

      // Add user message
      const userMessage: ChatMessage = { role: "user", content: userText };
      setMessages(prev => [...prev, userMessage]);
      setCurrentTranscript(""); // Clear transcript

      // Get AI response
      const { data: chatData, error: chatError } = await supabase.functions.invoke('chat', {
        body: { 
          messages: [...messages, userMessage],
          system: "You are a helpful voice assistant. Keep responses conversational and concise since they will be spoken aloud. Be engaging and natural in your speech."
        }
      });

      if (chatError) {
        console.error('Chat error:', chatError);
        setIsProcessing(false);
        // Restart listening on error
        if (isAutoListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
        return;
      }

      const aiResponse = chatData.content;
      const aiMessage: ChatMessage = { role: "assistant", content: aiResponse };
      setMessages(prev => [...prev, aiMessage]);

      // Convert response to speech
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: aiResponse,
          voice: 'alloy'
        }
      });

      if (ttsError) {
        console.error('Text-to-speech error:', ttsError);
        setIsProcessing(false);
        // Restart listening on error
        if (isAutoListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
        return;
      }

      // Play audio response
      await playAudio(ttsData.audioContent);
      setIsProcessing(false);

      // Automatically start listening again after AI finishes speaking
      if (isAutoListeningRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setIsProcessing(false);
      // Restart listening on error
      if (isAutoListeningRef.current) {
        setTimeout(() => startListening(), 500);
      }
    }
  }, [currentTranscript, messages, startListening]);

  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      setIsPlaying(true);

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
      
      audio.volume = isMuted ? 0 : volume;
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  }, [volume, isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = isMuted ? volume : 0;
    }
  }, [isMuted, volume]);

  const startConversation = useCallback(() => {
    isAutoListeningRef.current = true;
    startListening();
  }, [startListening]);

  const stopConversation = useCallback(() => {
    isAutoListeningRef.current = false;
    stopRecording();
    setIsListening(false);
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(false);
    }

    // Clear timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, [stopRecording]);

  // Update volume when it changes
  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (currentAudioRef.current && !isMuted) {
      currentAudioRef.current.volume = newVolume;
    }
  }, [isMuted]);

  return {
    messages,
    isRecording,
    isPlaying,
    isProcessing,
    isMuted,
    volume,
    isListening,
    currentTranscript,
    startRecording: startConversation,
    stopRecording: stopConversation,
    toggleMute,
    setVolume: updateVolume
  };
};