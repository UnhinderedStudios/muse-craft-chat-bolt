import { useState, useRef, useCallback } from "react";
import { ChatMessage } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceChatState {
  messages: ChatMessage[];
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  volume: number;
}

export const useVoiceChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      audioChunksRef.current = [];

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // Convert speech to text
        const { data: sttData, error: sttError } = await supabase.functions.invoke('speech-to-text', {
          body: { audio: base64Audio }
        });

        if (sttError) {
          console.error('Speech-to-text error:', sttError);
          return;
        }

        const userText = sttData.text.trim();
        if (!userText) {
          console.log('No speech detected');
          setIsProcessing(false);
          return;
        }

        // Add user message
        const userMessage: ChatMessage = { role: "user", content: userText };
        setMessages(prev => [...prev, userMessage]);

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
          return;
        }

        // Play audio response
        await playAudio(ttsData.audioContent);
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      setIsProcessing(false);
    }
  }, [messages]);

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
    startRecording,
    stopRecording,
    toggleMute,
    setVolume: updateVolume
  };
};