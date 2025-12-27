import React, { useState, useEffect, useCallback } from 'react';
import { Phrase, Deck, CardState } from '../types';
import { Button } from './Button';
import { ArrowLeft, CheckCircle2, XCircle, Eye, HelpCircle, ArrowRight, ListOrdered, X, ArrowDownToLine, StickyNote, Save, Keyboard, BarChart2, Clock, Edit2, Trash2, MoreVertical } from 'lucide-react';

interface StudySessionProps {
  deck: Deck;
  onUpdateDeck: (updatedDeck: Deck) => void;
  onExit: () => void;
  onReview: (phraseId: string, isCorrect: boolean) => void; 
  onTimeUpdate: (seconds: number) => void; 
  onSessionComplete?: (durationSeconds: number, correctCount: number, wrongCount: number) => void; // New callback
}

export const StudySession: React.FC<StudySessionProps> = ({ deck, onUpdateDeck, onExit, onReview, onTimeUpdate, onSessionComplete }) => {
  // Initialize state directly from props to ensure valid start state
  const [queue, setQueue] = useState<string[]>([...deck.queue]);
  const [currentPhraseId, setCurrentPhraseId] = useState<string | null>(deck.queue.length > 0 ? deck.queue[0] : null);
  const [cardState, setCardState] = useState<CardState>(CardState.HIDDEN);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Edit / Note states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ english: '', chinese: '', note: '' });

  // Feedback state for the transition screen
  const [feedback, setFeedback] = useState<{ insertIndex: number; isCorrect: boolean } | null>(null);

  // Timer for study duration
  useEffect(() => {
    const timer = setInterval(() => {
      onTimeUpdate(1);
      setSessionDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeUpdate]);

  // Sync internal edit form content when phrase changes or edit mode opens
  useEffect(() => {
    if (currentPhraseId) {
       const phrase = deck.phrases.find(p => p.id === currentPhraseId);
       if (phrase) {
         setEditForm({
           english: phrase.english,
           chinese: phrase.chinese,
           note: phrase.note || ''
         });
       }
       setIsEditing(false);
    }
  }, [currentPhraseId, deck.phrases]);

  // Fallback: if somehow currentPhraseId gets lost but queue exists
  useEffect(() => {
    if (!currentPhraseId && queue.length > 0) {
      setCurrentPhraseId(queue[0]);
      setCardState(CardState.HIDDEN);
    }
  }, [queue, currentPhraseId]);

  const currentPhrase = deck.phrases.find(p => p.id === currentPhraseId);

  const handleExit = () => {
    if (onSessionComplete) {
      onSessionComplete(sessionDuration, sessionStats.correct, sessionStats.wrong);
    }
    onExit();
  };

  // Handle saving edits (Content + Note)
  const handleSaveEdit = useCallback(() => {
    if (!currentPhraseId) return;
    
    const updatedPhrases = deck.phrases.map(p => {
      if (p.id === currentPhraseId) {
        return { 
          ...p, 
          english: editForm.english,
          chinese: editForm.chinese,
          note: editForm.note 
        };
      }
      return p;
    });

    onUpdateDeck({ ...deck, phrases: updatedPhrases });
    setIsEditing(false);
  }, [currentPhraseId, deck, editForm, onUpdateDeck]);

  const handleDeletePhrase = useCallback(() => {
    if (!currentPhraseId || !window.confirm("确定要删除这个词组吗？")) return;

    const updatedPhrases = deck.phrases.filter(p => p.id !== currentPhraseId);
    const updatedQueue = queue.filter(id => id !== currentPhraseId);
    const nextQueue = deck.queue.filter(id => id !== currentPhraseId);

    // Update parent
    onUpdateDeck({ ...deck, phrases: updatedPhrases, queue: nextQueue });
    
    // Move to next
    if (updatedQueue.length > 0) {
      setQueue(updatedQueue);
      setCurrentPhraseId(updatedQueue[0]);
      setCardState(CardState.HIDDEN);
    } else {
      setQueue([]);
      setCurrentPhraseId(null);
    }
    setIsEditing(false);
  }, [currentPhraseId, deck, queue, onUpdateDeck]);

  // Helper to calculate new queue and stats
  const calculateResult = useCallback((isCorrect: boolean) => {
    if (!deck.phrases || !currentPhraseId) return null;

    // Trigger global review stats with result
    onReview(currentPhraseId, isCorrect);

    // 1. Remove current from front
    const nextQueue = [...queue];
    nextQueue.shift(); 

    // 2. Update Phrase Stats
    const updatedPhrases = deck.phrases.map(p => {
      if (p.id === currentPhraseId) {
        return {
          ...p,
          totalReviews: p.totalReviews + 1,
          consecutiveCorrect: isCorrect ? p.consecutiveCorrect + 1 : 0,
          consecutiveWrong: isCorrect ? 0 : p.consecutiveWrong + 1,
          lastReviewedAt: Date.now()
        };
      }
      return p;
    });

    const updatedPhrase = updatedPhrases.find(p => p.id === currentPhraseId)!;

    // 3. Calculate Re-insertion Index (Queue Logic)
    let insertOffset = 0;

    if (!isCorrect) {
      // Wrong: Behind 2. If consecutive wrong is multiple of 3, behind 10.
      if (updatedPhrase.consecutiveWrong > 0 && updatedPhrase.consecutiveWrong % 3 === 0) {
        insertOffset = 10;
      } else {
        insertOffset = 2;
      }
    } else {
      // Correct: Behind 2^(x+1)
      insertOffset = Math.pow(2, updatedPhrase.consecutiveCorrect + 1);
    }

    // Insert back into queue
    // We want to know the index where it ends up
    let actualInsertIndex = insertOffset;
    if (insertOffset > nextQueue.length) {
      nextQueue.push(currentPhraseId);
      actualInsertIndex = nextQueue.length;
    } else {
      nextQueue.splice(insertOffset, 0, currentPhraseId);
    }

    return { updatedPhrases, nextQueue, insertOffset: actualInsertIndex };
  }, [deck.phrases, currentPhraseId, onReview, queue]);

  // Actions wrapped in useCallback for Keyboard listener dependencies
  const handleDontKnow = useCallback(() => {
    const result = calculateResult(false);
    if (!result) return;

    onUpdateDeck({
      ...deck,
      phrases: result.updatedPhrases,
      queue: result.nextQueue
    });
    setQueue(result.nextQueue);
    setSessionStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
    setFeedback({ insertIndex: result.insertOffset, isCorrect: false });
    setCardState(CardState.MISSED);
  }, [calculateResult, deck, onUpdateDeck]);

  const handleKnow = useCallback(() => {
    setCardState(CardState.VERIFYING);
  }, []);

  const handleVerdict = useCallback((isCorrect: boolean) => {
    const result = calculateResult(isCorrect);
    if (!result) return;

    onUpdateDeck({
      ...deck,
      phrases: result.updatedPhrases,
      queue: result.nextQueue
    });
    setQueue(result.nextQueue);
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));

    setFeedback({ insertIndex: result.insertOffset, isCorrect });
    setCardState(CardState.REVIEWED);
  }, [calculateResult, deck, onUpdateDeck]);

  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      setCurrentPhraseId(queue[0]);
      setCardState(CardState.HIDDEN);
      setFeedback(null);
    } else {
      setCurrentPhraseId(null);
    }
  }, [queue]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in edit form
      if (isEditing || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (cardState === CardState.HIDDEN) {
        if (e.key === '1') handleKnow();
        if (e.key === '2') handleDontKnow();
      } else if (cardState === CardState.VERIFYING) {
        if (e.key === '1') handleVerdict(true);
        if (e.key === '2') handleVerdict(false);
      } else if (cardState === CardState.MISSED || cardState === CardState.REVIEWED) {
        // Allow 1 or 2 or Space or Enter for Next
        if (e.key === '1' || e.key === '2' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault(); // Prevent scrolling on Space
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cardState, isEditing, handleKnow, handleDontKnow, handleVerdict, handleNext]);


  // Formatting logic: Underline for both Chinese and English
  const renderFormattedText = (text: string, isChinese: boolean = false) => {
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

  const formatSessionTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalReviewed = sessionStats.correct + sessionStats.wrong;

  // Render Stats Logic
  const renderStatsOverlay = () => {
    const stats = deck.phrases.reduce((acc, p) => {
       if (p.totalReviews === 0) {
         acc.new++;
       } else if (p.consecutiveWrong > 0) {
         const k = p.consecutiveWrong;
         if (k === 1) acc.w1++;
         else if (k === 2) acc.w2++;
         else if (k === 3) acc.w3++;
         else if (k <= 5) acc.w4_5++;
         else if (k <= 10) acc.w6_10++;
         else acc.w10_plus++;
       } else {
         const k = p.consecutiveCorrect;
         if (k === 1) acc.c1++;
         else if (k === 2) acc.c2++;
         else if (k === 3) acc.c3++;
         else if (k <= 5) acc.c4_5++;
         else if (k <= 10) acc.c6_10++;
         else acc.c10_plus++;
       }
       return acc;
    }, { 
      new: 0, 
      w1: 0, w2: 0, w3: 0, w4_5: 0, w6_10: 0, w10_plus: 0,
      c1: 0, c2: 0, c3: 0, c4_5: 0, c6_10: 0, c10_plus: 0 
    });

    const Row = ({ label, count, color }: any) => {
       if (!count) return null;
       return (
         <div className={`flex justify-between text-xs py-1 ${color}`}>
            <span>{label}</span>
            <span className="font-bold">{count}</span>
         </div>
       );
    }

    return (
      <div className="absolute top-14 left-4 sm:left-auto sm:right-4 bg-white shadow-xl rounded-xl p-4 z-50 border border-slate-100 min-w-[240px] animate-in slide-in-from-top-2">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
           <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4"/> 状态分布</h3>
           <button onClick={() => setShowStats(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-0.5">
           <Row label="新词" count={stats.new} color="text-slate-600" />
           {stats.new > 0 && <div className="h-px bg-slate-50 my-1"></div>}
           
           <Row label="错1" count={stats.w1} color="text-red-600" />
           <Row label="错2" count={stats.w2} color="text-red-600" />
           <Row label="错3" count={stats.w3} color="text-red-600" />
           <Row label="错4-5" count={stats.w4_5} color="text-red-800" />
           <Row label="错6-10" count={stats.w6_10} color="text-red-800" />
           <Row label="错10+" count={stats.w10_plus} color="text-red-900" />
           
           {(stats.w1+stats.w2+stats.w3+stats.w4_5+stats.w6_10+stats.w10_plus > 0) && <div className="h-px bg-slate-50 my-1"></div>}

           <Row label="对1" count={stats.c1} color="text-orange-600" />
           <Row label="对2" count={stats.c2} color="text-orange-600" />
           <Row label="对3" count={stats.c3} color="text-orange-600" />
           <Row label="对4-5" count={stats.c4_5} color="text-blue-600" />
           <Row label="对6-10" count={stats.c6_10} color="text-indigo-600" />
           <Row label="对10+" count={stats.c10_plus} color="text-emerald-600" />
        </div>
      </div>
    );
  };

  // Queue Sidebar Renderer
  const renderQueueSidebar = () => (
    <div className={`fixed inset-y-0 right-0 w-full sm:w-80 bg-white shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${showQueue ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <ListOrdered className="w-4 h-4 text-indigo-600" />
          当前队列 ({queue.length})
        </h3>
        <button onClick={() => setShowQueue(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {queue.map((id, idx) => {
          const p = deck.phrases.find(ph => ph.id === id);
          if (!p) return null;
          const isJustMoved = (cardState === CardState.MISSED || cardState === CardState.REVIEWED) && id === currentPhraseId;
          
          return (
            <div key={`${id}-${idx}`} className={`p-2.5 rounded-lg border text-sm flex justify-between items-center transition-all duration-500 ${isJustMoved ? 'bg-indigo-100 border-indigo-300 ring-2 ring-indigo-200' : (idx === 0 ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100')}`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`text-[10px] font-mono w-4 shrink-0 ${idx === 0 ? 'text-slate-600 font-bold' : 'text-slate-400'}`}>
                  {idx + 1}.
                </span>
                <div className="truncate">
                  <div className="font-medium text-slate-800 truncate text-xs">{renderFormattedText(p.chinese, true)}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.english}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // If deck is truly empty (deleted)
  if (!currentPhrase && queue.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 text-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">词组本为空</h2>
          <p className="text-slate-600 mb-6">没有可供复习的词组。</p>
          <Button onClick={handleExit} fullWidth>返回主页</Button>
        </div>
      </div>
    );
  }

  // Safety loading state
  if (!currentPhrase) return <div className="fixed inset-0 bg-slate-100 flex items-center justify-center z-50">Loading...</div>;

  const isRevealed = cardState !== CardState.HIDDEN;
  const isFeedbackState = cardState === CardState.MISSED || cardState === CardState.REVIEWED;
  const hasNote = Boolean(currentPhrase.note && currentPhrase.note.trim());

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col relative overflow-hidden h-full">
      {/* Overlay for Sidebar ONLY */}
      {showQueue && (
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setShowQueue(false)}
        />
      )}
      
      {renderQueueSidebar()}
      {showStats && renderStatsOverlay()}

      {/* Compact Header */}
      <div className="bg-white shadow-sm px-3 py-2 flex justify-between items-center z-10 shrink-0 h-12 relative">
        <button onClick={handleExit} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-slate-800 font-semibold cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-full flex items-center gap-1 max-w-[40vw] sm:max-w-none truncate text-sm" onClick={() => setShowStats(!showStats)}>
           <span className="truncate">{deck.name}</span>
           <BarChart2 className="w-3 h-3 text-slate-400 shrink-0" />
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 text-slate-600 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="font-mono">{formatSessionTime(sessionDuration)}</span>
           </div>
          <button onClick={() => setShowQueue(true)} className="p-1.5 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-md transition-colors relative">
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Card Area - Flexible and Centered */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-y-auto flex flex-col relative transition-all duration-300 max-h-full flex-1">
          
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center w-full relative">
            
            {/* Edit/Action Buttons (Top Right of Card) */}
            <div className="absolute top-2 right-2 z-20 flex gap-1">
               <button 
                 onClick={() => setIsEditing(!isEditing)}
                 className={`p-2 rounded-full transition-colors ${isEditing ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                 title="编辑词组"
               >
                 <Edit2 className="w-4 h-4" />
               </button>
            </div>

            {isEditing ? (
              // Edit Mode
              <div className="w-full space-y-4 text-left animate-in fade-in">
                 <div>
                   <label className="text-xs text-slate-400 font-bold uppercase">中文释义</label>
                   <input 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                      value={editForm.chinese}
                      onChange={e => setEditForm({...editForm, chinese: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="text-xs text-slate-400 font-bold uppercase">英文词组</label>
                   <input 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium text-indigo-700"
                      value={editForm.english}
                      onChange={e => setEditForm({...editForm, english: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="text-xs text-slate-400 font-bold uppercase">批注 / 笔记</label>
                   <textarea 
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none text-sm"
                      value={editForm.note}
                      onChange={e => setEditForm({...editForm, note: e.target.value})}
                   />
                 </div>
                 <div className="flex justify-between pt-2">
                   <Button variant="danger" onClick={handleDeletePhrase} className="py-1 px-3 text-sm">
                      <Trash2 className="w-4 h-4 mr-1"/> 删除
                   </Button>
                   <div className="flex gap-2">
                     <Button variant="ghost" onClick={() => setIsEditing(false)} className="py-1 px-3 text-sm">取消</Button>
                     <Button onClick={handleSaveEdit} className="py-1 px-3 text-sm"><Save className="w-4 h-4 mr-1"/> 保存</Button>
                   </div>
                 </div>
              </div>
            ) : (
              // View Mode
              <>
                {/* Chinese */}
                <div className="space-y-2 flex-1 flex flex-col justify-center w-full min-h-[100px]">
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 leading-tight break-words hyphens-auto">
                    {renderFormattedText(currentPhrase.chinese, true)}
                  </h1>
                </div>

                {/* Note Display (Compact) */}
                {isRevealed && hasNote && (
                  <div className="w-full max-w-lg mx-auto bg-amber-50 text-amber-800 px-4 py-2 rounded-lg text-sm border border-amber-100 flex items-start gap-2 my-4 animate-in fade-in">
                    <StickyNote className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                    <p className="text-left whitespace-pre-wrap flex-1">{currentPhrase.note}</p>
                  </div>
                )}

                {/* English */}
                {isRevealed && (
                  <div className="w-full pt-6 border-t border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-2xl sm:text-3xl font-bold text-indigo-600 break-words hyphens-auto leading-tight">
                      {renderFormattedText(currentPhrase.english, false)}
                    </p>
                    
                    {/* Feedback - Compact */}
                    {isFeedbackState && feedback && (
                      <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold animate-in fade-in slide-in-from-bottom-2 ${feedback.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {feedback.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>
                          {feedback.isCorrect ? '正确' : '错误'} 
                          <span className="opacity-60 mx-1">|</span> 
                          后移 {feedback.insertIndex} 位
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls - Fixed at bottom of card */}
          {!isEditing && (
            <div className="bg-slate-50 p-3 sm:p-5 border-t border-slate-100 shrink-0">
              {/* STATE: HIDDEN */}
              {cardState === CardState.HIDDEN && (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleKnow}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-sm transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-1 right-1 text-[10px] font-mono text-slate-300 border border-slate-200 rounded px-1">1</div>
                    <Eye className="w-6 h-6 text-emerald-500 mb-1" />
                    <span className="text-base font-bold text-slate-700">认识</span>
                  </button>
                  <button 
                    onClick={handleDontKnow}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-white border border-slate-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 hover:shadow-sm transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-1 right-1 text-[10px] font-mono text-slate-300 border border-slate-200 rounded px-1">2</div>
                    <HelpCircle className="w-6 h-6 text-orange-400 mb-1" />
                    <span className="text-base font-bold text-slate-700">不认识</span>
                  </button>
                </div>
              )}

              {/* STATE: FEEDBACK */}
              {isFeedbackState && (
                <Button onClick={handleNext} fullWidth className="py-4 text-lg shadow-lg shadow-indigo-100 animate-in fade-in duration-200">
                  <span className="flex items-center gap-2">下一个 <ArrowRight className="w-5 h-5"/></span>
                </Button>
              )}

              {/* STATE: VERIFYING */}
              {cardState === CardState.VERIFYING && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                  <button 
                    onClick={() => handleVerdict(true)}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-emerald-100 border border-emerald-200 rounded-xl hover:bg-emerald-200 transition-all active:scale-95 relative overflow-hidden"
                  >
                    <div className="absolute top-1 right-1 text-[10px] font-mono text-emerald-700/50 border border-emerald-300 rounded px-1">1</div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-1" />
                    <span className="text-lg font-bold text-emerald-800">正确</span>
                  </button>
                  <button 
                    onClick={() => handleVerdict(false)}
                    className="flex flex-col items-center justify-center py-4 px-2 bg-red-100 border border-red-200 rounded-xl hover:bg-red-200 transition-all active:scale-95 relative overflow-hidden"
                  >
                    <div className="absolute top-1 right-1 text-[10px] font-mono text-red-700/50 border border-red-300 rounded px-1">2</div>
                    <XCircle className="w-8 h-8 text-red-600 mb-1" />
                    <span className="text-lg font-bold text-red-800">不正确</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};