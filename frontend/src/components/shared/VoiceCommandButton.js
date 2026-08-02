import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2, X, Plane, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Voice commands configuration
const VOICE_COMMANDS = [
  { 
    patterns: ['book helicopter', 'book flight', 'helicopter book'],
    action: 'navigate',
    path: '/booking',
    response: 'Opening booking page'
  },
  {
    patterns: ['go to dashboard', 'open dashboard', 'dashboard'],
    action: 'navigate',
    path: '/admin',
    response: 'Opening dashboard'
  },
  {
    patterns: ['command center', 'open command center', 'monitoring'],
    action: 'navigate',
    path: '/command-center',
    response: 'Opening command center'
  },
  {
    patterns: ['ai pricing', 'pricing advisor', 'price suggestion'],
    action: 'navigate',
    path: '/ai-pricing',
    response: 'Opening AI pricing advisor'
  },
  {
    patterns: ['search', 'find', 'look for'],
    action: 'search',
    response: 'What would you like to search for?'
  },
  {
    patterns: ['mumbai to pune', 'pune to mumbai'],
    action: 'booking',
    origin: 'Mumbai',
    destination: 'Pune',
    response: 'Setting up Mumbai to Pune booking'
  },
  {
    patterns: ['delhi to jaipur', 'jaipur to delhi'],
    action: 'booking',
    origin: 'Delhi',
    destination: 'Jaipur',
    response: 'Setting up Delhi to Jaipur booking'
  },
  {
    patterns: ['help', 'what can you do', 'commands'],
    action: 'help',
    response: 'I can help you book helicopters, navigate pages, and search. Try saying "Book helicopter Mumbai to Pune"'
  }
];

function VoiceCommandButton({ onCommand, className = '' }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // Check for browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  const processCommand = useCallback((text) => {
    const lowerText = text.toLowerCase().trim();
    
    for (const command of VOICE_COMMANDS) {
      for (const pattern of command.patterns) {
        if (lowerText.includes(pattern)) {
          // Execute command
          if (command.action === 'navigate') {
            navigate(command.path);
            toast.success(command.response);
          } else if (command.action === 'booking') {
            navigate(`/booking?origin=${command.origin}&destination=${command.destination}`);
            toast.success(command.response);
          } else if (command.action === 'search') {
            // Trigger global search
            const searchEvent = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
            document.dispatchEvent(searchEvent);
            toast.info(command.response);
          } else if (command.action === 'help') {
            toast.info(command.response, { duration: 5000 });
          }
          
          if (onCommand) {
            onCommand({ command: pattern, action: command.action, text: lowerText });
          }
          
          return true;
        }
      }
    }
    
    // No command matched
    toast.warning(`Command not recognized: "${text}". Try "help" for available commands.`);
    return false;
  }, [navigate, onCommand]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Voice commands not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setShowModal(true);
    };

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      
      setTranscript(text);
      
      if (result.isFinal) {
        setIsProcessing(true);
        setTimeout(() => {
          processCommand(text);
          setIsProcessing(false);
          setIsListening(false);
          setTimeout(() => setShowModal(false), 1500);
        }, 500);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        toast.info('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access.');
      } else {
        toast.error(`Voice error: ${event.error}`);
      }
      setIsListening(false);
      setShowModal(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [isSupported, processCommand]);

  const stopListening = () => {
    setIsListening(false);
    setShowModal(false);
  };

  return (
    <>
      {/* Voice Button */}
      <Button
        onClick={isListening ? stopListening : startListening}
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        className={`relative ${className}`}
        title={isSupported ? "Voice Command (Click to speak)" : "Voice not supported"}
        disabled={!isSupported}
        data-testid="voice-command-btn"
      >
        {isListening ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
        {isListening && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </Button>

      {/* Voice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-slate-400"
              onClick={stopListening}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Mic animation */}
            <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
              isListening ? 'bg-red-500/20 animate-pulse' : 'bg-green-500/20'
            }`}>
              {isProcessing ? (
                <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
              ) : isListening ? (
                <Mic className="h-12 w-12 text-red-500" />
              ) : (
                <Volume2 className="h-12 w-12 text-green-500" />
              )}
            </div>

            {/* Status */}
            <h3 className="text-xl font-semibold text-white mb-2">
              {isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Command Processed'}
            </h3>

            {/* Transcript */}
            {transcript && (
              <p className="text-slate-300 text-lg mb-4">
                "{transcript}"
              </p>
            )}

            {/* Help text */}
            {isListening && !transcript && (
              <p className="text-slate-400 text-sm">
                Try saying: "Book helicopter Mumbai to Pune"
              </p>
            )}

            {/* Example commands */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs mb-2">Example commands:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Book helicopter', 'Command center', 'AI pricing', 'Help'].map(cmd => (
                  <span key={cmd} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">
                    {cmd}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default VoiceCommandButton;
