import React, { useState, useEffect } from 'react';
import { Deck, Phrase, DeckSessionLog } from '../types';
import { Button } from './Button';
import { ArrowLeft, Trash2, Save, Plus, X, Search, Edit2, FileText, Copy, Check, AlertCircle, History, Calendar, Clock, GraduationCap, BookOpen, Target } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface DeckEditorProps {
  deck: Deck;
  onUpdateDeck: (updatedDeck: Deck) => void;
  onBack: () => void;
}

export const DeckEditor: React.FC<DeckEditorProps> = ({ deck, onUpdateDeck, onBack }) => {
  const [activeTab, setActiveTab] = useState<'phrases' | 'history'>('phrases');
  
  const [deckName, setDeckName] = useState(deck.name);
  const [phrases, setPhrases] = useState<Phrase[]>([...deck.phrases]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  
  // Batch View State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // UI Confirmation States
  const [phraseToDelete, setPhraseToDelete] = useState<string | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({ english: '', chinese: '', note: '' });

  // Sync state if deck prop changes
  useEffect(() => {
    setPhrases(deck.phrases);
    setDeckName(deck.name);
  }, [deck]);

  const handleSaveDeckName = () => {
    if (deckName.trim() !== deck.name) {
      onUpdateDeck({ ...deck, name: deckName, phrases });
    }
  };

  const confirmDeletePhrase = () => {
    if (phraseToDelete) {
      const updatedPhrases = phrases.filter(p => p.id !== phraseToDelete);
      setPhrases(updatedPhrases);
      // Update parent immediately
      const newQueue = deck.queue.filter(qId => qId !== phraseToDelete);
      onUpdateDeck({ ...deck, name: deckName, phrases: updatedPhrases, queue: newQueue });
      setPhraseToDelete(null);
    }
  };

  const startEditing = (phrase: Phrase) => {
    setEditingPhraseId(phrase.id);
    setEditForm({
      english: phrase.english,
      chinese: phrase.chinese,
      note: phrase.note || ''
    });
  };

  const cancelEditing = () => {
    setEditingPhraseId(null);
    setEditForm({ english: '', chinese: '', note: '' });
  };

  const savePhrase = () => {
    if (!editingPhraseId) return;
    
    const updatedPhrases = phrases.map(p => {
      if (p.id === editingPhraseId) {
        return {
          ...p,
          english: editForm.english,
          chinese: editForm.chinese,
          note: editForm.note
        };
      }
      return p;
    });

    setPhrases(updatedPhrases);
    onUpdateDeck({ ...deck, name: deckName, phrases: updatedPhrases });
    setEditingPhraseId(null);
  };

  const handleAddPhrase = () => {
    const newPhrase: Phrase = {
      id: uuidv4(),
      english: '',
      chinese: '',
      note: '',
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      totalReviews: 0
    };
    
    const updatedPhrases = [newPhrase, ...phrases];
    setPhrases(updatedPhrases);
    const newQueue = [newPhrase.id, ...deck.queue];
    
    onUpdateDeck({ ...deck, name: deckName, phrases: updatedPhrases, queue: newQueue });
    
    startEditing(newPhrase);
  };

  const generateBatchText = () => {
    const phraseMap = new Map<string, Phrase>(phrases.map(p => [p.id, p] as [string, Phrase]));
    const orderedPhrases: Phrase[] = [];
    const seenIds = new Set<string>();

    // 1. Add phrases currently in queue
    deck.queue.forEach(id => {
      const p = phraseMap.get(id);
      if (p) {
        orderedPhrases.push(p);
        seenIds.add(id);
      }
    });

    // 2. Add remaining phrases
    phrases.forEach(p => {
      if (!seenIds.has(p.id)) {
        orderedPhrases.push(p);
      }
    });

    return orderedPhrases.map((p, idx) => {
      const note = p.note || '';
      // Progress: correct (positive) or -wrong (negative)
      let progress = 0;
      if (p.consecutiveCorrect > 0) progress = p.consecutiveCorrect;
      else if (p.consecutiveWrong > 0) progress = -p.consecutiveWrong;

      // Format: English | Chinese | Note | Progress | Position
      return `${p.english} | ${p.chinese} | ${note} | ${progress} | ${idx}`;
    }).join('\n');
  };

  const openBatchModal = () => {
    setBatchText(generateBatchText());
    setShowBatchModal(true);
  };

  const confirmBatchSave = () => {
    const lines = batchText.split('\n').filter(l => l.trim().length > 0);
    
    const existingPhrasesMap = new Map<string, Phrase>();
    phrases.forEach(p => existingPhrasesMap.set(p.english.toLowerCase().trim(), p));

    // Parse lines first
    const parsedItems = lines.map((line, index) => {
       const parts = line.split('|').map(s => s.trim());
       if (parts.length < 2) return null;

       const eng = parts[0];
       const chi = parts[1];
       const note = parts[2] || '';
       
       let progress = 0;
       if (parts.length >= 4 && parts[3] !== '') {
          const val = parseInt(parts[3]);
          if (!isNaN(val)) progress = val;
       }
       
       let position: number | null = null;
       if (parts.length >= 5 && parts[4] !== '') {
          const val = parseInt(parts[4]);
          if (!isNaN(val)) position = val;
       }

       return { eng, chi, note, progress, position, originalIndex: index };
    }).filter(item => item !== null) as Array<{
        eng: string, chi: string, note: string, progress: number, position: number | null, originalIndex: number
    }>;

    // Sort based on position priority
    parsedItems.sort((a, b) => {
        const posA = a.position;
        const posB = b.position;
        
        // 1. Explicit Position vs No Position
        if (posA !== null && posB === null) return -1;
        if (posA === null && posB !== null) return 1;

        // 2. Both explicit position
        if (posA !== null && posB !== null) {
            if (posA !== posB) return posA - posB;
            
            // Positions are EQUAL.
            // Priority: New > Old.
            const keyA = a.eng.toLowerCase().trim();
            const keyB = b.eng.toLowerCase().trim();
            const isOldA = existingPhrasesMap.has(keyA);
            const isOldB = existingPhrasesMap.has(keyB);
            
            if (!isOldA && isOldB) return -1; // New before Old
            if (isOldA && !isOldB) return 1;  // Old after New
            
            // If same status (both New or both Old), respect line order
            return a.originalIndex - b.originalIndex;
        }

        // 3. Both implicit (no position) -> respect line order
        return a.originalIndex - b.originalIndex;
    });

    const newPhrasesList: Phrase[] = [];
    const newQueue: string[] = [];
    
    for (const item of parsedItems) {
         let correct = 0;
         let wrong = 0;
         if (item.progress > 0) correct = item.progress;
         if (item.progress < 0) wrong = Math.abs(item.progress);

         const key = item.eng.toLowerCase().trim();
         
         if (existingPhrasesMap.has(key)) {
           const existing = existingPhrasesMap.get(key)!;
           // Update stats if progress is provided (non-zero) or if user explicitly explicitly set 0
           
           let totalReviews = existing.totalReviews;
           // If manually setting stats, estimate total reviews if it looks small
           if (correct + wrong > totalReviews) {
              totalReviews = correct + wrong; 
           }
           
           const p: Phrase = {
             ...existing,
             english: item.eng,
             chinese: item.chi,
             note: item.note,
             consecutiveCorrect: correct,
             consecutiveWrong: wrong,
             totalReviews: totalReviews
           };
           newPhrasesList.push(p);
           newQueue.push(p.id);
         } else {
           const newId = uuidv4();
           newPhrasesList.push({
             id: newId,
             english: item.eng,
             chinese: item.chi,
             note: item.note,
             consecutiveCorrect: correct,
             consecutiveWrong: wrong,
             totalReviews: correct + wrong
           });
           newQueue.push(newId);
         }
    }

    setPhrases(newPhrasesList);
    onUpdateDeck({ ...deck, name: deckName, phrases: newPhrasesList, queue: newQueue });
    setShowBatchModal(false);
  };

  const handleCopyBatch = () => {
    const textToCopy = showBatchModal ? batchText : generateBatchText();
    navigator.clipboard.writeText(textToCopy);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const filteredPhrases = phrases.filter(p => 
    p.english.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.chinese.includes(searchQuery)
  );

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/\[(.*?)\]/g);
    return (
      <>
        {parts.map((part, i) => (
          i % 2 === 1 ? (
            <span key={i} className="border-b-2 border-indigo-500 pb-0.5 text-indigo-700 font-semibold mx-0.5">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        ))}
      </>
    );
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return `${m}m ${seconds % 60}s`;
  };

  const formatDate = (ts: number) => {
      return new Date(ts).toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">词组本名称</label>
          <input 
            type="text" 
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            onBlur={handleSaveDeckName}
            className="text-2xl font-bold text-slate-900 w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
         <button 
           onClick={() => setActiveTab('phrases')}
           className={`pb-2 text-sm font-medium transition-colors border-b-2 px-2 ${activeTab === 'phrases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           词组管理 ({phrases.length})
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`pb-2 text-sm font-medium transition-colors border-b-2 px-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           学习历史
         </button>
      </div>

      {activeTab === 'phrases' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-4 z-20">
            <div className="relative w-full sm:w-auto flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索词组..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button onClick={handleCopyBatch} variant="outline" className={`flex-1 sm:flex-none ${copyFeedback ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}`}>
                 {copyFeedback ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                 复制列表
              </Button>
              <Button onClick={openBatchModal} variant="outline" className="flex-1 sm:flex-none">
                <FileText className="w-4 h-4 mr-2" /> 批量编辑
              </Button>
              <Button onClick={handleAddPhrase} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4 mr-2" /> 添加词组
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredPhrases.map(phrase => (
              <div 
                key={phrase.id} 
                className={`bg-white rounded-xl border transition-all ${editingPhraseId === phrase.id ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-lg' : 'border-slate-200 hover:border-slate-300 shadow-sm'}`}
              >
                {editingPhraseId === phrase.id ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">英文</label>
                        <input 
                          type="text" 
                          value={editForm.english}
                          onChange={(e) => setEditForm({...editForm, english: e.target.value})}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">中文释义</label>
                        <input 
                          type="text" 
                          value={editForm.chinese}
                          onChange={(e) => setEditForm({...editForm, chinese: e.target.value})}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">批注 / 笔记</label>
                      <textarea 
                        value={editForm.note}
                        onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                        placeholder="可选..."
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="ghost" onClick={cancelEditing}>取消</Button>
                      <Button onClick={savePhrase} disabled={!editForm.english.trim() || !editForm.chinese.trim()}>
                        <Save className="w-4 h-4 mr-2" /> 保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 truncate text-lg">{phrase.english}</h3>
                        {phrase.note && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Has note"></span>}
                      </div>
                      <p className="text-slate-600 truncate">{renderFormattedText(phrase.chinese)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <div className="hidden sm:flex flex-col items-end mr-4 text-xs text-slate-400">
                          <span>复习 {phrase.totalReviews} 次</span>
                          <span className={`${phrase.consecutiveWrong > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {phrase.consecutiveWrong > 0 ? `连错 ${phrase.consecutiveWrong}` : `连对 ${phrase.consecutiveCorrect}`}
                          </span>
                       </div>
                       
                       <button 
                         type="button"
                         onClick={() => startEditing(phrase)}
                         className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                         title="编辑"
                       >
                         <Edit2 className="w-5 h-5" />
                       </button>
                       <button 
                         type="button"
                         onClick={() => setPhraseToDelete(phrase.id)}
                         className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                         title="删除"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPhrases.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                {searchQuery ? '未找到匹配的词组' : '词组本为空，请添加词组'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
           {(!deck.sessionHistory || deck.sessionHistory.length === 0) ? (
             <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
               <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
               <p>暂无学习记录</p>
             </div>
           ) : (
             <div className="grid gap-3">
               {deck.sessionHistory.map((log) => {
                  const acc = log.reviewCount > 0 ? Math.round((log.correctCount / log.reviewCount) * 100) : 0;
                  return (
                    <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${log.mode === 'EXAM' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                             {log.mode === 'EXAM' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm">{log.mode === 'EXAM' ? '模拟考试' : '日常练习'}</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
                                   <Clock className="w-3 h-3" />
                                   {formatTime(log.durationSeconds)}
                                </span>
                             </div>
                             <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(log.timestamp)}
                             </div>
                          </div>
                       </div>
                       
                       <div className="text-right">
                          <div className="flex flex-col items-end">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`text-lg font-bold ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {acc}%
                                </span>
                                <span className="text-xs text-slate-400">正确率</span>
                             </div>
                             <div className="text-xs text-slate-500 font-mono">
                                <span className="text-emerald-600 font-bold">{log.correctCount}</span>
                                <span className="mx-1">/</span>
                                <span className="text-slate-600">{log.reviewCount}</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
               })}
             </div>
           )}
        </div>
      )}

      {/* Batch Export/Edit Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full flex flex-col max-h-[85vh] animate-in zoom-in-95 relative">
             <div className="flex justify-between items-center mb-4 shrink-0">
               <div>
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <FileText className="w-5 h-5 text-indigo-600" /> 批量编辑 / 导出
                 </h3>
                 <p className="text-xs text-slate-500 mt-1">您可以直接修改下方文本来批量添加、修改或删除。</p>
               </div>
               <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                 <X className="w-6 h-6" />
               </button>
             </div>
             
             <div className="bg-amber-50 p-3 rounded-md mb-2 text-xs text-amber-800 border border-amber-100 flex items-start gap-2">
               <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
               <div className="space-y-1">
                 <p className="font-bold">格式：英文 | 中文 | 批注(选) | 进度(选) | 位置(选)</p>
                 <ul className="list-disc list-inside opacity-90 space-y-0.5 ml-1">
                    <li><strong>进度</strong>: 正数为连对次数，负数为连错次数 (例如 <code>-2</code>)。</li>
                    <li><strong>位置</strong>: 队列中的序号 (0为第一位)。不填则按行顺序追加到最后。</li>
                    <li>示例: <code>Apple | 苹果 | 水果 | 5 | 0</code> (连对5次，排第1位)</li>
                 </ul>
               </div>
             </div>

             <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 relative group shadow-inner">
                <textarea 
                  className="w-full h-full p-4 bg-transparent resize-none focus:outline-none font-mono text-sm text-slate-700 custom-scrollbar focus:ring-2 focus:ring-inset focus:ring-indigo-500 rounded-lg"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="Hello | 你好 | | | 0"
                />
             </div>

             <div className="mt-4 flex justify-end gap-3 shrink-0">
                <Button variant="outline" onClick={handleCopyBatch} className={copyFeedback ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}>
                  {copyFeedback ? (
                    <>
                      <Check className="w-4 h-4 mr-2" /> 已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" /> 复制全部
                    </>
                  )}
                </Button>
                <div className="w-px bg-slate-200 mx-1"></div>
                <Button variant="ghost" onClick={() => setShowBatchModal(false)}>取消</Button>
                <Button onClick={confirmBatchSave}>
                  <Save className="w-4 h-4 mr-2" /> 保存修改
                </Button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {phraseToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 text-center mb-4">删除此词组？</h3>
            <div className="flex gap-3 w-full">
              <Button variant="secondary" fullWidth onClick={() => setPhraseToDelete(null)}>取消</Button>
              <Button variant="danger" fullWidth onClick={confirmDeletePhrase}>删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};