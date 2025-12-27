import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Deck, Phrase } from '../types';
import { Button } from './Button';
import { ArrowLeft, CheckCircle2, XCircle, Eye, HelpCircle, Trophy, Clock, ArrowRight } from 'lucide-react';

interface ExamSessionProps {
  deck: Deck;
  questionCount: number;
  onUpdateDeck: (updatedDeck: Deck) => void;
  onExit: () => void;
  onReview: (phraseId: string, isCorrect: boolean) => void; 
  onTimeUpdate: (seconds: number) => void;
  onSessionComplete?: (durationSeconds: number, correctCount: number, wrongCount: number) => void; // New callback
}

type ExamStep = 'QUESTION' | 'REVEAL' | 'RESULT';

export const ExamSession: React.FC<ExamSessionProps> = ({ 
  deck, 
  questionCount, 
  onUpdateDeck, 
  onExit, 
  onReview, 
  onTimeUpdate,
  onSessionComplete
}) => {
  // Setup exam questions
  const [questions, setQuestions] = useState<Phrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<ExamStep>('QUESTION');
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [results, setResults] = useState<{phrase: Phrase, correct: boolean}[]>([]);
  
  // Guard to prevent re-initialization on deck updates
  const isInitialized = useRef(false);

  // Initialize Exam
  useEffect(() => {
    if (isInitialized.current) return;

    // Shuffle and slice
    const shuffled = [...deck.phrases].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(questionCount, deck.phrases.length));
    setQuestions(selected);
    
    isInitialized.current = true;
  }, [deck.phrases, questionCount]);

  // Timer
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      onTimeUpdate(1);
      setSessionDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeUpdate, isFinished]);

  const handleReveal = useCallback(() => {
    setStep('REVEAL');
  }, []);

  const handleExit = () => {
      // For exam, if exited early, we still record what was done
      const answered = results.length;
      if (onSessionComplete && answered > 0) {
          const correct = results.filter(r => r.correct).length;
          const wrong = answered - correct;
          onSessionComplete(sessionDuration, correct, wrong);
      }
      onExit();
  };

  const handleVerdict = useCallback((correct: boolean) => {
    const currentPhrase = questions[currentIndex];
    
    // Update Stats immediately with result
    onReview(currentPhrase.id, correct);
    
    // Update Phrase in Deck
    const updatedPhrases = deck.phrases.map(p => {
      if (p.id === currentPhrase.id) {
        return {
          ...p,
          totalReviews: p.totalReviews + 1,
          consecutiveCorrect: correct ? p.consecutiveCorrect + 1 : 0,
          consecutiveWrong: correct ? 0 : p.consecutiveWrong + 1,
          lastReviewedAt: Date.now()
        };
      }
      return p;
    });

    onUpdateDeck({ ...deck, phrases: updatedPhrases });

    // Track Result
    setResults(prev => [...prev, { phrase: currentPhrase, correct }]);
    if (correct) setScore(prev => prev + 1);

    // Next Question or Finish
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStep('QUESTION');
    } else {
      setIsFinished(true);
      setStep('RESULT');
    }
  }, [currentIndex, deck, onReview, onUpdateDeck, questions]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (isFinished) {
        // Simple exit on Space/Enter when finished
        const handleFinishKey = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleExit();
            }
        };
        window.addEventListener('keydown', handleFinishKey);
        return () => window.removeEventListener('keydown', handleFinishKey);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === 'QUESTION') {
        if (e.key === ' ' || e.key === 'Enter' || e.key === '1') {
          e.preventDefault();
          handleReveal();
        }
      } else if (step === 'REVEAL') {
        if (e.key === '1') handleVerdict(true);
        if (e.key === '2') handleVerdict(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isFinished, handleReveal, handleVerdict, onExit]);


  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/\[(.*?)\]/g);
    return (
      <>
        {parts.map((part, i) => (
          i % 2 === 1 ? (
             <span key={i} className="border-b-2 border-indigo-500 pb-0.5 font-semibold text-indigo-700 mx-0.5">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        ))}
      </>
    );
  };

  if (questions.length === 0) return <div className="p-10 text-center">Loading Exam...</div>;

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    let gradeColor = 'text-emerald-600';
    let gradeText = 'Excellent!';
    if (percentage < 60) { gradeColor = 'text-red-600'; gradeText = 'Keep Trying!'; }
    else if (percentage < 80) { gradeColor = 'text-amber-600'; gradeText = 'Good Job!'; }

    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 z-50 animate-in zoom-in-95">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Trophy className="w-10 h-10 text-indigo-600" />
          </div>
          
          <div>
            <h2 className="text-3xl font-bold text-slate-900">考试结束</h2>
            <p className={`text-xl font-bold mt-2 ${gradeColor}`}>{gradeText}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-6 border-t border-b border-slate-100">
             <div className="space-y-1">
               <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">得分</div>
               <div className="text-4xl font-black text-slate-800">{percentage}<span className="text-lg text-slate-400">%</span></div>
               <div className="text-sm text-slate-500">{score} / {questions.length} 正确</div>
             </div>
             <div className="space-y-1">
               <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">用时</div>
               <div className="text-4xl font-black text-slate-800">{formatTime(sessionDuration)}</div>
               <div className="text-sm text-slate-500">Avg {Math.round(sessionDuration/questions.length)}s/题</div>
             </div>
          </div>

          <Button onClick={handleExit} fullWidth className="py-3 text-lg">
            返回主页 (Enter)
          </Button>
        </div>
      </div>
    );
  }

  const currentPhrase = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
           <button onClick={handleExit} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
             <ArrowLeft className="w-5 h-5" />
           </button>
           <div>
             <h2 className="font-bold text-slate-800 text-sm">模拟考试</h2>
             <div className="text-xs text-slate-500 flex items-center gap-2">
               <Clock className="w-3 h-3" /> {formatTime(sessionDuration)}
             </div>
           </div>
        </div>
        <div className="font-mono font-bold text-indigo-600 text-lg">
          {currentIndex + 1} <span className="text-slate-300 text-sm">/ {questions.length}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200 w-full">
        <div 
          className="h-full bg-indigo-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col min-h-[400px]">
           <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-8">
              
              {/* Question */}
              <div className="space-y-4">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-wider">
                  Question {currentIndex + 1}
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                  {renderFormattedText(currentPhrase.chinese)}
                </h1>
              </div>

              {/* Answer Area */}
              {step === 'REVEAL' && (
                 <div className="w-full pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-2xl sm:text-3xl font-bold text-indigo-600 mb-2">
                       {renderFormattedText(currentPhrase.english)}
                    </p>
                    {currentPhrase.note && (
                      <p className="text-slate-500 text-sm bg-slate-50 inline-block px-3 py-1 rounded-lg mt-2">
                        {currentPhrase.note}
                      </p>
                    )}
                 </div>
              )}
           </div>

           {/* Controls */}
           <div className="bg-slate-50 p-6 border-t border-slate-100">
             {step === 'QUESTION' ? (
                <div className="space-y-2">
                  <Button onClick={handleReveal} fullWidth className="py-4 text-lg shadow-lg shadow-indigo-100">
                     <Eye className="w-5 h-5 mr-2" /> 查看答案
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center">Press Space to reveal</p>
                </div>
             ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleVerdict(true)}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-emerald-100 border border-emerald-200 rounded-xl hover:bg-emerald-200 transition-all active:scale-95 shadow-sm group relative"
                  >
                    <div className="absolute top-2 right-2 text-[10px] font-mono text-emerald-600/50 border border-emerald-300 rounded px-1">1</div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-emerald-800">正确</span>
                  </button>
                  <button 
                    onClick={() => handleVerdict(false)}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-red-100 border border-red-200 rounded-xl hover:bg-red-200 transition-all active:scale-95 shadow-sm group relative"
                  >
                    <div className="absolute top-2 right-2 text-[10px] font-mono text-red-600/50 border border-red-300 rounded px-1">2</div>
                    <XCircle className="w-8 h-8 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-red-800">错误</span>
                  </button>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};