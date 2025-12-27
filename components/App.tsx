import React, { useState, useEffect, useRef } from 'react';
import { AppView, Deck, Phrase, GlobalStats, BackupData } from '../types';
import { StudySession } from './StudySession';
import { Importer } from './Importer';
import { DeckEditor } from './DeckEditor';
import { ExamSession } from './ExamSession';
import { DailyReport } from './DailyReport';
import { Button } from './Button';
import { PlusCircle, BookOpen, Trash2, BrainCircuit, ListOrdered, CheckCircle2, XCircle, BarChart2, FolderInput, CopyPlus, X, Clock, Edit, AlertTriangle, Settings, Download, Upload, FileJson, Check, GraduationCap, Play, FileText, Target, Hash } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'recallflow_data_v1';
const STATS_KEY = 'recallflow_stats_v1';

// Timezone Helper (UTC+8)
const getTodayDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  
  // Exam State
  const [examConfig, setExamConfig] = useState<{ count: number } | null>(null);
  const [showExamSetup, setShowExamSetup] = useState(false);
  const [tempExamCount, setTempExamCount] = useState(20);

  // Stats State
  const [stats, setStats] = useState<GlobalStats>({
    totalReviewCount: 0,
    totalPhrasesCount: 0,
    totalStudyTimeSeconds: 0,
    daily: {
      date: getTodayDate(),
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0,
      reviewedPhraseIds: [],
      studyTimeSeconds: 0
    }
  });

  // UI States
  const [mergingDeckId, setMergingDeckId] = useState<string | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  useEffect(() => {
    // Load Decks
    const storedDecks = localStorage.getItem(STORAGE_KEY);
    if (storedDecks) {
      try {
        const parsed = JSON.parse(storedDecks);
        // Ensure data integrity & add default stats for old decks
        const sanitized = Array.isArray(parsed) ? parsed.map((d: any) => ({
          ...d,
          phrases: d.phrases || [],
          queue: d.queue || [],
          stats: d.stats || { totalStudyTimeSeconds: 0, totalReviewCount: 0 }
        })) : [];
        setDecks(sanitized);
      } catch (e) {
        console.error("Failed to parse decks", e);
        setDecks([]);
      }
    } else {
      // Demo Data
      const phrases: Phrase[] = [
        { id: '1', chinese: '你好', english: 'Hello', consecutiveCorrect: 0, consecutiveWrong: 0, totalReviews: 0, note: '最基础的问候' },
        { id: '2', chinese: '谢谢', english: 'Thank you', consecutiveCorrect: 1, consecutiveWrong: 0, totalReviews: 1 },
      ];
      const demoDeck: Deck = {
        id: uuidv4(),
        name: "示例：日常高频口语",
        phrases: phrases,
        queue: ['1', '2'],
        stats: { totalStudyTimeSeconds: 0, totalReviewCount: 0 }
      };
      setDecks([demoDeck]);
    }

    // Load Stats
    const storedStats = localStorage.getItem(STATS_KEY);
    if (storedStats) {
      try {
        const parsed = JSON.parse(storedStats);
        // Check if date changed (UTC+8)
        const today = getTodayDate();
        
        if (parsed.daily?.date !== today) {
          // Reset daily stats but keep totals
          setStats({
            ...parsed,
            daily: {
              date: today,
              reviewCount: 0,
              correctCount: 0,
              wrongCount: 0,
              reviewedPhraseIds: [],
              studyTimeSeconds: 0
            }
          });
        } else {
          // Safe merge for potential missing legacy fields
          setStats({
             ...parsed,
             totalStudyTimeSeconds: parsed.totalStudyTimeSeconds || 0,
             daily: {
               ...(parsed.daily || {}),
               studyTimeSeconds: parsed.daily?.studyTimeSeconds || 0,
               correctCount: parsed.daily?.correctCount || 0,
               wrongCount: parsed.daily?.wrongCount || 0,
               reviewedPhraseIds: parsed.daily?.reviewedPhraseIds || []
             }
          });
        }
      } catch (e) {
        console.error("Failed to parse stats", e);
      }
    }
  }, []);

  // Save Data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  }, [decks]);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  // --- Sync / Backup Logic ---

  const handleExportBackup = () => {
    const backup: BackupData = {
      version: 1,
      timestamp: Date.now(),
      decks: decks,
      stats: stats
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = getTodayDate();
    downloadAnchorNode.setAttribute("download", `recallflow_backup_${date}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        
        const backup = JSON.parse(text) as BackupData;
        
        // Simple Validation
        if (!Array.isArray(backup.decks) || !backup.stats) {
          throw new Error("Invalid backup format");
        }

        // Apply Data - Ensure decks have stat objects
        const hydratedDecks = backup.decks.map(d => ({
          ...d,
          stats: d.stats || { totalStudyTimeSeconds: 0, totalReviewCount: 0 }
        }));
        
        setDecks(hydratedDecks);
        setStats(backup.stats);
        
        setImportStatus('success');
        setTimeout(() => {
           setImportStatus('idle');
           setShowSettings(false);
           // Force view refresh
           setView(AppView.DASHBOARD);
        }, 1500);
      } catch (err) {
        console.error("Import failed", err);
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(fileObj);
    // Reset input so same file can be selected again if needed
    event.target.value = '';
  };

  // --- Logic Ends ---

  // Handle Review Stat Update
  const handleReviewStat = (phraseId: string, isCorrect: boolean) => {
    // 1. Update Global & Daily Stats
    setStats(prev => {
      const currentReviewIds = prev.daily?.reviewedPhraseIds || [];
      const isNewDailyPhrase = !currentReviewIds.includes(phraseId);
      
      return {
        ...prev,
        totalReviewCount: (prev.totalReviewCount || 0) + 1,
        daily: {
          ...prev.daily,
          reviewCount: (prev.daily?.reviewCount || 0) + 1,
          correctCount: (prev.daily?.correctCount || 0) + (isCorrect ? 1 : 0),
          wrongCount: (prev.daily?.wrongCount || 0) + (isCorrect ? 0 : 1),
          reviewedPhraseIds: isNewDailyPhrase 
            ? [...currentReviewIds, phraseId] 
            : currentReviewIds
        }
      };
    });

    // 2. Update Deck Stats
    if (activeDeckId) {
      setDecks(prev => prev.map(d => {
        if (d.id === activeDeckId) {
           return {
             ...d,
             stats: {
               ...d.stats,
               totalReviewCount: (d.stats?.totalReviewCount || 0) + 1,
               totalStudyTimeSeconds: d.stats?.totalStudyTimeSeconds || 0 // Preserve time
             }
           };
        }
        return d;
      }));
    }
  };

  const handleTimeUpdate = (seconds: number) => {
    // 1. Update Global Stats
    setStats(prev => ({
      ...prev,
      totalStudyTimeSeconds: (prev.totalStudyTimeSeconds || 0) + seconds,
      daily: {
        ...prev.daily,
        studyTimeSeconds: (prev.daily?.studyTimeSeconds || 0) + seconds
      }
    }));

    // 2. Update Deck Stats
    if (activeDeckId) {
      setDecks(prev => prev.map(d => {
        if (d.id === activeDeckId) {
           return {
             ...d,
             stats: {
               ...d.stats,
               totalStudyTimeSeconds: (d.stats?.totalStudyTimeSeconds || 0) + seconds,
               totalReviewCount: d.stats?.totalReviewCount || 0 // Preserve count
             }
           };
        }
        return d;
      }));
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0秒';
    if (seconds < 60) return `${seconds}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分`;
  };

  const handleCreateDeck = (name: string, phrases: Phrase[]) => {
    const newDeck: Deck = {
      id: uuidv4(),
      name,
      phrases,
      queue: phrases.map(p => p.id),
      stats: { totalStudyTimeSeconds: 0, totalReviewCount: 0 }
    };
    setDecks(prev => [...prev, newDeck]);
    setView(AppView.DASHBOARD);
  };

  const confirmDeleteDeck = () => {
    if (deckToDelete) {
      setDecks(prev => prev.filter(d => d.id !== deckToDelete));
      setDeckToDelete(null);
    }
  };

  const promptDeleteDeck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeckToDelete(id);
  };

  const handleEditDeck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDeckId(id);
    setView(AppView.EDIT_DECK);
  };

  const updateDeck = (updatedDeck: Deck) => {
    setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));
  };

  // Merge Logic
  const initiateMerge = (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMergingDeckId(deckId);
  };

  const performMerge = (targetDeckId: string) => {
    if (!mergingDeckId) return;
    
    const sourceDeck = decks.find(d => d.id === mergingDeckId);
    if (!sourceDeck) return;

    // Deep copy phrases with NEW IDs
    const newPhrases = (sourceDeck.phrases || []).map(p => ({
      ...p,
      id: uuidv4(), // Generate new ID
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      totalReviews: 0
    }));

    const newPhraseIds = newPhrases.map(p => p.id);

    setDecks(prev => prev.map(d => {
      if (d.id === targetDeckId) {
        return {
          ...d,
          phrases: [...(d.phrases || []), ...newPhrases],
          queue: [...(d.queue || []), ...newPhraseIds] // Append to end of queue
        };
      }
      return d;
    }));

    setMergingDeckId(null);
    alert(`成功将 "${sourceDeck.name}" 的内容合并到目标词组本中！`);
  };

  // Exam Logic
  const initiateExam = (deckId: string, e: React.MouseEvent) => {
     e.stopPropagation();
     e.preventDefault();
     setActiveDeckId(deckId);
     const deck = decks.find(d => d.id === deckId);
     if (deck) {
       setTempExamCount(Math.min(20, deck.phrases.length));
       setShowExamSetup(true);
     }
  };

  const startExam = () => {
     if (activeDeckId) {
        setExamConfig({ count: tempExamCount });
        setShowExamSetup(false);
        setView(AppView.EXAM_SESSION);
     }
  };

  const renderQueuePreview = (deck: Deck) => {
    const previewIds = deck.queue || [];
    if (previewIds.length === 0) {
      return <div className="text-sm text-slate-400 italic">队列为空</div>;
    }
    return (
      <div className="space-y-2 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col max-h-48">
        <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 shrink-0">
          <ListOrdered className="w-3 h-3 mr-1" /> 
          复习队列 ({previewIds.length})
        </div>
        <div className="overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {previewIds.map((id, index) => {
            const phrase = (deck.phrases || []).find(p => p.id === id);
            if (!phrase) return null;
            return (
              <div key={`${id}-${index}`} className="flex justify-between items-center text-sm border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                <span className="text-slate-700 truncate mr-2 flex-1 flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-xs w-5 text-right shrink-0">{index + 1}.</span>
                  <span className="truncate">{phrase.chinese}</span>
                </span>
                <div className="flex shrink-0">
                  {phrase.consecutiveWrong > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3 mr-0.5" />
                      {phrase.consecutiveWrong}
                    </span>
                  ) : phrase.consecutiveCorrect > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {phrase.consecutiveCorrect}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                      新
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDeckStats = (deck: Deck) => {
    const phrases = deck.phrases || [];
    const stats = phrases.reduce((acc, p) => {
      if (p.consecutiveWrong > 0) {
        const key = `W${p.consecutiveWrong}`;
        acc.wrong[key] = (acc.wrong[key] || 0) + 1;
      } else if (p.consecutiveCorrect > 0) {
        const key = `C${p.consecutiveCorrect}`;
        acc.correct[key] = (acc.correct[key] || 0) + 1;
      } else {
        acc.new = (acc.new || 0) + 1;
      }
      return acc;
    }, { correct: {} as Record<string, number>, wrong: {} as Record<string, number>, new: 0 });

    const correctKeys = Object.keys(stats.correct).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    const wrongKeys = Object.keys(stats.wrong).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    return (
      <div className="mt-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          <BarChart2 className="w-3 h-3 mr-1" /> 状态分布
        </div>
        <div className="space-y-2">
           {stats.new > 0 && (
             <div className="flex items-center justify-between text-xs">
               <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-300"></span> 新词组</span>
               <span className="font-mono font-medium text-slate-700">{stats.new}</span>
             </div>
           )}
           {wrongKeys.length > 0 && (
             <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
               {wrongKeys.map(k => (
                 <div key={k} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-50 text-red-700 rounded-md">
                   <XCircle className="w-3 h-3" />
                   <span>连错 {k.slice(1)}次:</span>
                   <span className="font-bold">{stats.wrong[k]}个</span>
                 </div>
               ))}
             </div>
           )}
           {correctKeys.length > 0 && (
             <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
               {correctKeys.map(k => (
                 <div key={k} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                   <CheckCircle2 className="w-3 h-3" />
                   <span>连对 {k.slice(1)}次:</span>
                   <span className="font-bold">{stats.correct[k]}个</span>
                 </div>
               ))}
             </div>
           )}
           {stats.new === 0 && wrongKeys.length === 0 && correctKeys.length === 0 && (
             <div className="text-xs text-slate-400 italic">暂无数据</div>
           )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header & Global Stats */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BrainCircuit className="text-indigo-600" /> 英语词组记忆
            </h1>
            <p className="text-slate-500 mt-1">无限滚动复习队列 | 智能间隔重复算法</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             <Button onClick={() => setShowDailyReport(true)} variant="outline" className="px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50" title="今日报告">
               <FileText className="w-5 h-5 mr-1" /> 今日报告
             </Button>
             <Button onClick={() => setShowSettings(true)} variant="secondary" className="px-3" title="数据管理 / 同步">
               <Settings className="w-5 h-5" />
             </Button>
             <Button onClick={() => setView(AppView.IMPORT)} className="shadow-lg shadow-indigo-200 flex-1 md:flex-none">
               <PlusCircle className="w-5 h-5 mr-2" /> 新建词组本
             </Button>
          </div>
        </div>
        
        {/* Global Statistics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">历史累计复习次数</span>
              <span className="text-2xl font-bold text-indigo-600 mt-1">{stats.totalReviewCount} <span className="text-sm font-normal text-slate-400">次</span></span>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">今日复习次数</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1">{stats.daily.reviewCount} <span className="text-sm font-normal text-slate-400">次</span></span>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">今日复习词组数</span>
              <span className="text-2xl font-bold text-amber-600 mt-1">{stats.daily.reviewedPhraseIds.length} <span className="text-sm font-normal text-slate-400">个 (去重)</span></span>
           </div>
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">今日学习时长</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 flex items-center gap-1">
                {formatTime(stats.daily.studyTimeSeconds)}
                <Clock className="w-4 h-4 text-slate-300" />
              </span>
           </div>
        </div>
      </div>

      {/* Deck List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {decks.map(deck => (
          <div 
            key={deck.id}
            className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all relative overflow-hidden flex flex-col h-full"
          >
             {/* Action Buttons Top Right */}
             <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
               <button 
                  type="button"
                  onClick={(e) => initiateMerge(deck.id, e)}
                  className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full p-2 transition-colors border border-slate-100 bg-white shadow-sm"
                  title="合并到..."
                >
                  <CopyPlus className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={(e) => handleEditDeck(deck.id, e)}
                  className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full p-2 transition-colors border border-slate-100 bg-white shadow-sm"
                  title="编辑 / 管理词组"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={(e) => promptDeleteDeck(deck.id, e)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-2 transition-colors border border-slate-100 bg-white shadow-sm"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
            </div>
            
            <div className="cursor-pointer space-y-4">
              <div onClick={() => { setActiveDeckId(deck.id); setView(AppView.STUDY); }}>
                 <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1 pr-16">{deck.name}</h3>
                  </div>
                </div>

                <div className="space-y-3 mb-4 shrink-0">
                   <div className="flex gap-4 mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                         <Clock className="w-3 h-3 text-blue-400" />
                         <span className="font-mono">{formatTime(deck.stats?.totalStudyTimeSeconds || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                         <Hash className="w-3 h-3 text-indigo-400" />
                         <span className="font-mono font-bold text-slate-700">{deck.stats?.totalReviewCount || 0}</span>
                         <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-1 ml-0.5" title="去重后的复习词组数量">
                           ({deck.phrases.filter(p => p.totalReviews > 0).length}词)
                         </span>
                      </div>
                   </div>

                  <div className="flex justify-between text-sm text-slate-500">
                    <span>词组总库</span>
                    <span className="font-medium text-slate-900">{deck.phrases.length}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>队列长度</span>
                    <span className="font-medium text-slate-900">{deck.queue.length}</span>
                  </div>
                </div>
              </div>

               {/* Quick Action Bar */}
               <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <Button 
                    variant="primary" 
                    className="text-xs py-1.5"
                    onClick={() => { setActiveDeckId(deck.id); setView(AppView.STUDY); }}
                  >
                     <Play className="w-3 h-3 mr-1.5" /> 开始复习
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="text-xs py-1.5"
                    onClick={(e) => initiateExam(deck.id, e)}
                  >
                     <GraduationCap className="w-3 h-3 mr-1.5" /> 模拟考试
                  </Button>
               </div>
            </div>

            {/* Detailed Stats */}
            <div className="shrink-0">
               {renderDeckStats(deck)}
            </div>

            {/* Queue Visualization */}
            <div className="flex-1 min-h-[120px]">
              {renderQueuePreview(deck)}
            </div>
          </div>
        ))}

        {decks.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <BookOpen className="w-16 h-16 mb-6 opacity-50" />
            <h3 className="text-xl font-medium text-slate-600 mb-2">暂无词组本</h3>
            <p className="mb-8 text-center max-w-sm">您可以手动创建词组本，或者输入一个主题让 AI 为您自动生成高质量的英语词组。</p>
            <Button variant="outline" onClick={() => setView(AppView.IMPORT)}>创建第一个词组本</Button>
          </div>
        )}
      </div>

      {/* Settings / Sync Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Settings className="w-6 h-6 text-slate-500" /> 数据管理
               </h3>
               <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 p-1">
                 <X className="w-6 h-6" />
               </button>
             </div>
             
             <div className="space-y-6">
               {/* Export Section */}
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                     <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                       <Download className="w-5 h-5" />
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800">导出存档</h4>
                       <p className="text-xs text-slate-500">下载 .json 格式的备份文件</p>
                     </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    您可以将存档文件发送到手机或其他设备，然后通过“导入存档”功能同步进度。
                  </p>
                  <Button onClick={handleExportBackup} fullWidth variant="outline">
                    <FileJson className="w-4 h-4 mr-2" /> 下载备份文件
                  </Button>
               </div>

               {/* Import Section */}
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                     <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                       <Upload className="w-5 h-5" />
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800">导入存档</h4>
                       <p className="text-xs text-slate-500">恢复之前的进度或同步数据</p>
                     </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    注意：导入操作将<strong>覆盖</strong>当前设备上的所有数据，请谨慎操作。
                  </p>
                  
                  <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  
                  <Button 
                    onClick={handleImportClick} 
                    fullWidth 
                    variant="outline"
                    className={importStatus === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : importStatus === 'error' ? 'border-red-500 text-red-600 bg-red-50' : ''}
                  >
                    {importStatus === 'idle' && <><Upload className="w-4 h-4 mr-2" /> 选择备份文件</>}
                    {importStatus === 'success' && <><Check className="w-4 h-4 mr-2" /> 导入成功！</>}
                    {importStatus === 'error' && <><AlertTriangle className="w-4 h-4 mr-2" /> 文件格式错误</>}
                  </Button>
               </div>
             </div>
             
             <div className="mt-6 text-center text-xs text-slate-400">
               版本: v1.1.0 (Sync Enabled)
             </div>
          </div>
        </div>
      )}

      {/* Daily Report Modal */}
      {showDailyReport && (
        <DailyReport 
          stats={stats.daily} 
          decks={decks} 
          onClose={() => setShowDailyReport(false)} 
        />
      )}

      {/* Merge Modal Overlay */}
      {mergingDeckId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <CopyPlus className="w-5 h-5 text-indigo-600" /> 合并词组本
               </h3>
               <button onClick={() => setMergingDeckId(null)} className="text-slate-400 hover:text-slate-600">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-sm text-indigo-800">
               正在将 <strong>{decks.find(d => d.id === mergingDeckId)?.name}</strong> 的内容复制并合并到...
             </div>

             <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
               {decks.filter(d => d.id !== mergingDeckId).map(targetDeck => (
                 <button 
                    key={targetDeck.id}
                    onClick={() => performMerge(targetDeck.id)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                 >
                    <span className="font-medium text-slate-700 group-hover:text-indigo-900">{targetDeck.name}</span>
                    <FolderInput className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                 </button>
               ))}
               {decks.length <= 1 && (
                 <div className="text-center text-slate-400 py-4 italic">
                   没有其他词组本可供合并。
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deckToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">确定删除吗？</h3>
                <p className="text-slate-500 mt-2 text-sm">此操作将永久删除该词组本及其所有学习进度，无法撤销。</p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <Button variant="secondary" fullWidth onClick={() => setDeckToDelete(null)}>取消</Button>
                <Button variant="danger" fullWidth onClick={confirmDeleteDeck}>删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exam Setup Modal */}
      {showExamSetup && activeDeckId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                   <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">模拟考试设置</h3>
             </div>
             
             <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">题目数量</label>
                <div className="flex items-center gap-4">
                   <input 
                      type="number" 
                      min="1"
                      max={decks.find(d => d.id === activeDeckId)?.phrases.length || 20}
                      value={tempExamCount}
                      onChange={(e) => setTempExamCount(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                   />
                   <span className="text-slate-400 text-sm whitespace-nowrap">
                      / {decks.find(d => d.id === activeDeckId)?.phrases.length || 0} 题
                   </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                   考试过程中的答题情况将计入复习统计。
                </p>
             </div>

             <div className="flex gap-3">
               <Button variant="ghost" fullWidth onClick={() => setShowExamSetup(false)}>取消</Button>
               <Button fullWidth onClick={startExam}>开始考试</Button>
             </div>
          </div>
        </div>
      )}

    </div>
  );

  if (view === AppView.STUDY && activeDeckId) {
    const deck = decks.find(d => d.id === activeDeckId);
    if (deck) {
      return (
        <StudySession
          deck={deck}
          onUpdateDeck={updateDeck}
          onExit={() => setView(AppView.DASHBOARD)}
          onReview={handleReviewStat}
          onTimeUpdate={handleTimeUpdate}
        />
      );
    }
  }

  if (view === AppView.IMPORT) {
    return (
      <Importer
        onImport={handleCreateDeck}
        onBack={() => setView(AppView.DASHBOARD)}
      />
    );
  }

  if (view === AppView.EDIT_DECK && activeDeckId) {
    const deck = decks.find(d => d.id === activeDeckId);
    if (deck) {
      return (
        <DeckEditor
          deck={deck}
          onUpdateDeck={updateDeck}
          onBack={() => setView(AppView.DASHBOARD)}
        />
      );
    }
  }

  if (view === AppView.EXAM_SESSION && activeDeckId && examConfig) {
    const deck = decks.find(d => d.id === activeDeckId);
    if (deck) {
      return (
        <ExamSession
          deck={deck}
          questionCount={examConfig.count}
          onUpdateDeck={updateDeck}
          onExit={() => setView(AppView.DASHBOARD)}
          onReview={handleReviewStat}
          onTimeUpdate={handleTimeUpdate}
        />
      );
    }
  }

  return renderDashboard();
};

export default App;