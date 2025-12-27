import React from 'react';
import { DailyStats, Deck, Phrase } from '../types';
import { X, Clock, BrainCircuit, Target, ListChecks, BookOpen, GraduationCap } from 'lucide-react';

interface DailyReportProps {
  stats: DailyStats;
  decks: Deck[];
  onClose: () => void;
}

export const DailyReport: React.FC<DailyReportProps> = ({ stats, decks, onClose }) => {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分`;
  };

  const accuracy = stats.reviewCount > 0 
    ? Math.round((stats.correctCount / stats.reviewCount) * 100) 
    : 0;

  // Aggregate Content Logic
  // Prefer using `stats.activities` if available (new format), else try to infer from `reviewedPhraseIds` (legacy)
  
  let aggregatedContent: Array<{
    deckName: string;
    mode: 'STUDY' | 'EXAM' | 'UNKNOWN';
    count: number;
    correct: number;
  }> = [];

  if (stats.activities && stats.activities.length > 0) {
    aggregatedContent = stats.activities.map(a => ({
      deckName: a.deckName,
      mode: a.mode,
      count: a.count,
      correct: a.correct
    }));
  } else {
    // Fallback for legacy data (today's session before update): Group by Deck, Mode Unknown
    const deckCounts = new Map<string, { count: number, correct: number }>();
    
    // We can count items, but we can't easily know "correctness" per deck for legacy data without expensive re-parsing.
    // Let's just list the decks involved.
    stats.reviewedPhraseIds.forEach(id => {
       for (const deck of decks) {
          if (deck.phrases.some(p => p.id === id)) {
             const current = deckCounts.get(deck.name) || { count: 0, correct: 0 };
             deckCounts.set(deck.name, { count: current.count + 1, correct: 0 }); // Cannot infer correct count
             break;
          }
       }
    });

    Array.from(deckCounts.entries()).forEach(([name, val]) => {
       aggregatedContent.push({
         deckName: name,
         mode: 'UNKNOWN',
         count: val.count,
         correct: 0
       });
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 rounded-t-2xl">
           <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <BrainCircuit className="w-6 h-6 text-indigo-600" />
               每日学习报告
             </h2>
             <p className="text-sm text-slate-500 mt-1">{stats.date} (UTC+8)</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Summary Cards */}
        <div className="p-4 sm:p-6 grid grid-cols-3 gap-4 border-b border-slate-100 bg-white">
           <div className="bg-blue-50 p-3 sm:p-4 rounded-xl flex flex-col items-center justify-center text-center border border-blue-100">
             <Clock className="w-6 h-6 text-blue-500 mb-2" />
             <div className="text-xs sm:text-sm text-slate-500 font-medium">学习时长</div>
             <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{formatTime(stats.studyTimeSeconds)}</div>
           </div>
           <div className="bg-indigo-50 p-3 sm:p-4 rounded-xl flex flex-col items-center justify-center text-center border border-indigo-100">
             <Target className="w-6 h-6 text-indigo-600 mb-2" />
             <div className="text-xs sm:text-sm text-slate-500 font-medium">复习次数</div>
             <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{stats.reviewCount}</div>
             <div className="text-[10px] text-slate-400 mt-1 font-mono">
               <span className="text-emerald-600">✓{stats.correctCount}</span> / <span className="text-red-500">✗{stats.wrongCount}</span>
             </div>
           </div>
           <div className="bg-emerald-50 p-3 sm:p-4 rounded-xl flex flex-col items-center justify-center text-center border border-emerald-100">
             <div className="relative w-12 h-12 flex items-center justify-center mb-1 rounded-full" 
                  style={{ 
                    background: `conic-gradient(#10b981 ${accuracy}%, #e2e8f0 0)` 
                  }}>
               <div className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-700">{accuracy}%</span>
               </div>
             </div>
             <div className="text-xs sm:text-sm text-slate-500 font-medium">今日正确率</div>
           </div>
        </div>

        {/* Detailed List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
             <ListChecks className="w-4 h-4" />
             学习内容概览
           </h3>
           
           {aggregatedContent.length === 0 ? (
             <div className="text-center py-10 text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-200">
               今天还没有复习任何词组。
             </div>
           ) : (
             <div className="space-y-3">
               {aggregatedContent.map((item, idx) => {
                 const itemAcc = item.count > 0 ? Math.round((item.correct / item.count) * 100) : 0;
                 return (
                   <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-3">
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg ${item.mode === 'EXAM' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {item.mode === 'EXAM' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                         </div>
                         <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                               {item.deckName}
                               {item.mode === 'UNKNOWN' && <span className="text-[10px] text-slate-400 font-normal bg-slate-100 px-1.5 rounded">Legacy</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                               {item.mode === 'EXAM' ? '模拟考试' : '日常练习'}
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 justify-between sm:justify-end">
                         <div className="text-xs text-right">
                            <span className="block text-slate-400 uppercase font-bold tracking-wider text-[10px]">数量</span>
                            <span className="font-mono font-medium text-slate-700">{item.count} 词</span>
                         </div>
                         <div className="text-xs text-right">
                            <span className="block text-slate-400 uppercase font-bold tracking-wider text-[10px]">正确率</span>
                            <span className={`font-mono font-bold ${itemAcc >= 80 ? 'text-emerald-600' : (itemAcc >= 60 ? 'text-amber-600' : 'text-red-600')}`}>
                               {itemAcc}%
                            </span>
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>
           )}
        </div>

      </div>
    </div>
  );
};