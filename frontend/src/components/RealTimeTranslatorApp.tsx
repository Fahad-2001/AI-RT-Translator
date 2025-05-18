"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import RecordRTC, { StereoAudioRecorder } from "recordrtc"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Card, CardContent } from "./ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { AlertCircle, Mic, MicOff, Copy, Check, Volume2, ArrowLeftRight, Loader2, Moon, Sun, Send } from "lucide-react"
import { useTheme } from "./theme-provider"

declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult
    length: number
    item(index: number): SpeechRecognitionResult
  }

  interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative
    length: number
    final: boolean
    item(index: number): SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    transcript: string
    confidence: number
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: SpeechRecognitionError
  }

  type SpeechRecognitionError =
    | "aborted"
    | "audio-capture"
    | "bad-grammar"
    | "network"
    | "no-speech"
    | "not-allowed"
    | "service-not-allowed"
    | "language-not-supported"
}

const RealTimeTranslatorApp = () => {
  const { theme, setTheme } = useTheme()
  const [transcript, setTranscript] = useState<string>("")
  const [interimTranscript, setInterimTranscript] = useState<string>("")
  const [targetWord, setTargetWord] = useState<string>("Listen A3IL")
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessingStop, setIsProcessingStop] = useState<boolean>(false)
  const [transcription, setTranscription] = useState<string>("")
  const [translation, setTranslation] = useState<string>("")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [mainLanguage, setMainLanguage] = useState<string>("da-DK")
  const [otherLanguage, setOtherLanguage] = useState<string>("en-US")
  const [copied, setCopied] = useState<boolean>(false)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("text")
  const [isTranslating, setIsTranslating] = useState<boolean>(false)
  const [autoTranslate, setAutoTranslate] = useState<boolean>(false)

  const recognitionRef = useRef<any>(null)
  const RTCRecorderRef = useRef<RecordRTC | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const silenceDetectionActiveRef = useRef<boolean>(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoTranslateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const silenceThreshold = 0.02
  const silenceDuration = 2500
  const backendApiUrl = "http://localhost:8000/process-audio/" // Replace with your backend API URL
  const textTranslationUrl = "http://localhost:8000/translate-text/" // Replace with your text translation endpoint

  const playAudio = (audioBlob: Blob) => {
    // Create a URL for the audio blob
    const audioUrl = URL.createObjectURL(audioBlob)

    // Create an audio element and play the audio
    const audio = new Audio(audioUrl)
    setIsPlaying(true)
    audio.play()

    // Clean up the URL after the audio finishes playing
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      setIsPlaying(false)
    }
  }

  // After receiving the response from sendAudioToBackend
  const handleApiResponse = (response: any) => {
    setTranscription(response.transcription || "")
    setTranslation(response.translation || "")

    // Handle audio playback if audio is present
    if (response.translation_audio && response.translation_audio_mime_type) {
      const audioBlob = b64toBlob(response.translation_audio, response.translation_audio_mime_type)
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
      playAudio(audioBlob) // Play the audio
    } else {
      setAudioUrl(null)
    }
  }

  // Helper function to convert base64 to Blob
  function b64toBlob(b64Data: string, contentType: string) {
    const byteCharacters = atob(b64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: contentType })
  }

  const sendAudioToBackend = async (audioBlob: Blob): Promise<any> => {
    try {
      // Create FormData and append the blob with specific filename and type
      const formData = new FormData()
      formData.append("file", audioBlob, "audio.ogg")
      formData.append("main_language", mainLanguage)
      formData.append("other_language", otherLanguage)

      // Log the blob details for debugging
      console.log("Sending blob:", {
        size: audioBlob.size,
        type: audioBlob.type,
      })

      const response = await fetch(backendApiUrl, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseJson = await response.json()
      console.log("Response from backend:", responseJson)
      return responseJson
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred while sending audio."
      console.error("Error sending audio to backend:", errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Function to send text for translation
  const translateText = async () => {
    if (!transcription.trim()) return

    setIsTranslating(true)
    try {
      // In a real application, you would send this to your backend
      // For now, we'll simulate a response
      const response = await fetch(textTranslationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcription,
          source_language: mainLanguage,
          target_language: otherLanguage,
        }),
      })
      console.log("Response from translation API:", response)
      if (!response.ok) {
        // If the backend is not available, simulate a response for demo purposes
        console.log("Backend not available, simulating response")
        // Wait for a simulated delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Simple simulation - in a real app, this would come from the backend
        const simulatedTranslation = `[Translated from ${mainLanguage} to ${otherLanguage}]: ${transcription}`
        setTranslation(simulatedTranslation)
      } else {
        const data = await response.json()
        setTranslation(data.translation || "")

        // Handle audio if available
        if (data.translation_audio && data.translation_audio_mime_type) {
          const audioBlob = b64toBlob(data.translation_audio, data.translation_audio_mime_type)
          const url = URL.createObjectURL(audioBlob)
          setAudioUrl(url)
        }
      }
    } catch (error) {
      console.error("Error translating text:", error)
      // Simulate a response for demo purposes
      const simulatedTranslation = `[Translated from ${mainLanguage} to ${otherLanguage}]: ${transcription}`
      setTranslation(simulatedTranslation)
    } finally {
      setIsTranslating(false)
    }
  }

  // Handle auto-translation when text changes
  useEffect(() => {
    if (autoTranslate && transcription.trim()) {
      // Clear any existing timeout
      if (autoTranslateTimeoutRef.current) {
        clearTimeout(autoTranslateTimeoutRef.current)
      }

      // Set a new timeout to translate after 1 second of no typing
      autoTranslateTimeoutRef.current = setTimeout(() => {
        translateText()
      }, 1000)
    }

    return () => {
      if (autoTranslateTimeoutRef.current) {
        clearTimeout(autoTranslateTimeoutRef.current)
      }
    }
  }, [transcription, mainLanguage, otherLanguage, autoTranslate])

  const saveAudioLocally = (audioBlob: Blob, fileName: string) => {
    // Create a URL for the audio blob
    const audioUrl = URL.createObjectURL(audioBlob)

    // Create an anchor element and trigger a download
    const link = document.createElement("a")
    link.href = audioUrl
    link.download = fileName // Set the file name for the download
    document.body.appendChild(link)
    link.click()

    // Clean up the URL and remove the anchor element
    URL.revokeObjectURL(audioUrl)
    document.body.removeChild(link)
  }

  // Function to handle audio recording
  const handleAudioRecording = useCallback(
    async (stream: MediaStream) => {
      setIsRecording(true)
      setError(null)
      audioChunksRef.current = []

      try {
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyserRef.current = analyser

        source.connect(analyser)

        console.log("Initializing RecordRTC")
        RTCRecorderRef.current = new RecordRTC(stream, {
          type: "audio",
          mimeType: "audio/ogg",
          recorderType: StereoAudioRecorder,
          numberOfAudioChannels: 1,
          desiredSampRate: 16000,
          timeSlice: 1000, // Get data every second
          ondataavailable: (blob: Blob) => {
            if (blob.size > 0) {
              audioChunksRef.current.push(blob)
            }
          },
        })

        RTCRecorderRef.current.startRecording()
        startSilenceDetection(stream)
      } catch (error) {
        console.error("Error during recording:", error)
        setError(error instanceof Error ? error.message : "Unknown error occurred during recording.")
      }
    },
    [backendApiUrl],
  )

  const startSilenceDetection = (stream: MediaStream) => {
    if (!analyserRef.current) return

    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    silenceDetectionActiveRef.current = true // Activate silence detection

    const checkSilence = () => {
      // Stop the loop if silence detection is no longer active
      if (!analyserRef.current || !silenceDetectionActiveRef.current) return

      analyserRef.current.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        sum += data[i]
      }
      const average = sum / data.length
      const normalizedAverage = average / 256
      console.log("DataLength :", data.length, "Average volume:", average, "Normalized average:", normalizedAverage)
      if (normalizedAverage < silenceThreshold) {
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            console.log("Silence detected, stopping recording")
            stopAudioRecording(stream) // Stop recording
            silenceTimeoutRef.current = null
          }, silenceDuration)
        }
      } else {
        clearSilenceTimeout()
      }

      // Continue the loop
      requestAnimationFrame(checkSilence)
    }

    checkSilence() // Start the loop
  }

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  }

  // Function to stop audio recording
  const stopAudioRecording = useCallback(
    (stream: MediaStream) => {
      if (RTCRecorderRef.current && !isProcessingStop) {
        RTCRecorderRef.current.stopRecording(() => {
          const blob = RTCRecorderRef.current?.getBlob()
          if (blob) {
            setIsProcessingStop(true)
            console.log("Audio data collected:", blob.size)
            // saveAudioLocally(blob, "recorded_audio.ogg") // Commented out to avoid auto-download
            sendAudioToBackend(blob)
              .then(handleApiResponse)
              .catch((error) => {
                console.error("Error sending audio to backend:", error)
                setError("Failed to send audio to backend")
              })
              .finally(() => {
                setIsProcessingStop(false)
                RTCRecorderRef.current?.destroy()
                RTCRecorderRef.current = null
              })
          }
        })
      }
      silenceDetectionActiveRef.current = false
      clearSilenceTimeout()
      stream.getTracks().forEach((track) => track.stop())
    },
    [isProcessingStop],
  )

  // Use useCallback for the main recognition logic
  const setupRecognition = useCallback(() => {
    if ("webkitSpeechRecognition" in window) {
      recognitionRef.current = new window.webkitSpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = "en-US"

      recognitionRef.current.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = ""
        let currentInterimTranscript = ""
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript
          } else {
            currentInterimTranscript += event.results[i][0].transcript + " "
          }
        }
        setTranscript((prevTranscript) => prevTranscript + currentTranscript)
        setInterimTranscript(currentInterimTranscript)

        const lowerCaseTranscript = currentTranscript.toLowerCase()
        const lowerCaseTargetWord = targetWord.toLowerCase()
        if (lowerCaseTranscript.includes(lowerCaseTargetWord)) {
          console.log("Target word detected! Stopping recognition and starting recording.")
          if (recognitionRef.current) {
            recognitionRef.current.stop()
            setIsListening(false)
          }
          navigator.mediaDevices
            .getUserMedia({
              audio: {
                noiseSuppression: true, // Enable noise suppression
                echoCancellation: true, // Optional: Reduce echo
              },
            })
            .then((stream) => {
              handleAudioRecording(stream) // Pass stream
            })
            .catch((err) => {
              const errorMessage = err instanceof Error ? err.message : "Unknown error"
              setError(`Error starting recording after target word: ${errorMessage}`)
              console.error("Error starting recording after target word:", err)
            })
        }
      }

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        let errorMessage = "An unknown error occurred."
        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech was detected."
            break
          case "aborted":
            errorMessage = "Speech input was aborted."
            break
          case "audio-capture":
            errorMessage = "Failed to capture audio."
            break
          case "network":
            errorMessage = "A network error occurred."
            break
          case "not-allowed":
            errorMessage = "Permission to access the microphone was denied."
            break
          case "bad-grammar":
            errorMessage = "Invalid grammar was specified."
            break
          default:
            errorMessage = `An error occurred: ${event.error}`
        }
        setError(errorMessage)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        setInterimTranscript("")
      }
    } else {
      setError("Web Speech API is not supported in this browser.")
    }
  }, [handleAudioRecording, targetWord])

  // Initialize recognition on component mount
  useEffect(() => {
    setupRecognition()
    return () => {
      // Clean up speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
      }

      // Clean up RecordRTC
      if (RTCRecorderRef.current) {
        RTCRecorderRef.current.stopRecording(() => {
          RTCRecorderRef.current?.destroy()
          RTCRecorderRef.current = null
        })
      }

      // Clean up audio context
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close().catch((e) => console.error("Error closing audio context:", e))
        audioContextRef.current = null
      }

      // Clean up silence detection
      silenceDetectionActiveRef.current = false
      clearSilenceTimeout()
    }
  }, [setupRecognition])

  // Start recording directly
  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      })
      .then((stream) => {
        handleAudioRecording(stream)
      })
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(`Error starting recording: ${errorMessage}`)
        console.error("Error starting recording:", err)
      })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translation).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (err) => {
        console.error("Could not copy text: ", err)
      },
    )
  }

  const playTranslationAudio = () => {
    if (audioUrl && audioRef.current) {
      setIsPlaying(true)
      audioRef.current.play()
    }
  }

  const swapLanguages = () => {
    setMainLanguage(otherLanguage)
    setOtherLanguage(mainLanguage)
    setTranscription(translation)
    setTranslation(transcription)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const languages = [
    { code: "en-US", name: "English" },
    { code: "da-DK", name: "Danish" },
    { code: "ur-PK", name: "Urdu" },
    { code: "es-ES", name: "Spanish" },
    { code: "fr-FR", name: "French" },
    { code: "de-DE", name: "German" },
    { code: "it-IT", name: "Italian" },
    { code: "ja-JP", name: "Japanese" },
    { code: "ko-KR", name: "Korean" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "ru-RU", name: "Russian" },
    { code: "pt-BR", name: "Portuguese" },
    { code: "ar-SA", name: "Arabic" },
    { code: "hi-IN", name: "Hindi" },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">AI Real-Time Translator</h1>
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        {/* Custom tab styling to match the screenshot */}
        <div className="w-full bg-secondary rounded-md mb-4">
          <div className="flex">
            <div
              className={`flex-1 py-3 text-center cursor-pointer transition-colors ${activeTab === "text" ? "bg-background text-foreground" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("text")}
            >
              Text Translation
            </div>
            <div
              className={`flex-1 py-3 text-center cursor-pointer transition-colors ${activeTab === "voice" ? "bg-background text-foreground" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("voice")}
            >
              Voice Translation
            </div>
          </div>
        </div>

        {activeTab === "text" && (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row w-full">
                  {/* Source Language Panel */}
                  <div className="flex-1 border-b md:border-b-0 md:border-r border-border">
                    <div className="p-4 bg-muted/50 border-b border-border">
                      <Select value={mainLanguage} onValueChange={setMainLanguage}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-4">
                      <Textarea
                        value={transcription}
                        onChange={(e) => setTranscription(e.target.value)}
                        placeholder="Enter text to translate"
                        className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-lg"
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={translateText}
                          disabled={isTranslating || !transcription.trim()}
                          className="flex items-center gap-2"
                        >
                          {isTranslating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Translating...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Translate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Swap Languages Button (Mobile: Top, Desktop: Middle) */}
                  <div className="md:hidden flex justify-center py-2">
                    <Button variant="ghost" size="icon" onClick={swapLanguages} className="rounded-full">
                      <ArrowLeftRight className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Target Language Panel */}
                  <div className="flex-1 relative">
                    <div className="hidden md:flex absolute -left-6 top-1/2 transform -translate-y-1/2 z-10">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={swapLanguages}
                        className="rounded-full bg-background shadow-md h-12 w-12"
                      >
                        <ArrowLeftRight className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="p-4 bg-muted/50 border-b border-border">
                      <Select value={otherLanguage} onValueChange={setOtherLanguage}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-4 relative">
                      <Textarea
                        value={translation}
                        readOnly
                        placeholder="Translation will appear here"
                        className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-lg"
                      />
                      <div className="absolute bottom-4 right-4 flex space-x-2">
                        {audioUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={playTranslationAudio}
                            disabled={isPlaying}
                            className="rounded-full"
                          >
                            {isPlaying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Volume2 className="h-5 w-5" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={copyToClipboard} className="rounded-full">
                          {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center space-x-2 mt-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-translate"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="auto-translate" className="text-sm text-muted-foreground">
                  Auto-translate as you type
                </label>
              </div>
            </div>
          </>
        )}

        {activeTab === "voice" && (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      From: {languages.find((l) => l.code === mainLanguage)?.name}
                    </p>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={swapLanguages}>
                      <ArrowLeftRight className="h-5 w-5" />
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      To: {languages.find((l) => l.code === otherLanguage)?.name}
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      size="lg"
                      className={`h-24 w-24 rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : ""}`}
                      onClick={isRecording ? () => {} : startRecording}
                      disabled={isProcessingStop}
                    >
                      {isRecording ? (
                        <div className="flex flex-col items-center">
                          <MicOff className="h-8 w-8 mb-1" />
                          <span className="text-xs">Recording</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Mic className="h-8 w-8 mb-1" />
                          <span className="text-xs">Speak</span>
                        </div>
                      )}
                    </Button>
                    {isProcessingStop && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing...
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Original</h3>
                    <div className="p-4 bg-muted/50 rounded-md min-h-[100px]">
                      {transcription || <span className="text-muted-foreground">Your speech will appear here</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Translation</h3>
                    <div className="p-4 bg-muted/50 rounded-md min-h-[100px] relative">
                      {translation || <span className="text-muted-foreground">Translation will appear here</span>}

                      <div className="absolute bottom-2 right-2 flex space-x-2">
                        {audioUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={playTranslationAudio}
                            disabled={isPlaying}
                            className="h-8 w-8 rounded-full"
                          >
                            {isPlaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                          </Button>
                        )}
                        {translation && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={copyToClipboard}
                            className="h-8 w-8 rounded-full"
                          >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

export default RealTimeTranslatorApp
