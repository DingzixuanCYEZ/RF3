import React, { useState } from 'react';
import { Button } from './Button';
import { generatePhraseDeck } from '../services/geminiService';
import { Sparkles, Upload, Loader2, ArrowLeft, WifiOff } from 'lucide-react';
import { Phrase } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ImporterProps {
  onImport: (name: string, phrases: Phrase[]) => void;
  onBack: () => void;
}

export const Importer: React.FC<ImporterProps> = ({ onImport, onBack }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [deckName, setDeckName] = useState('');
  const [manualText, setManualText] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManualImport = () => {
    if (!deckName.trim()) {
      setError("请输入词组本名称。");
      return;
    }

    const lines = manualText.split('\n').filter(l => l.trim().length > 0);
    
    // Use similar logic to DeckEditor for parsing advanced fields
    const parsedItems = lines.map((line, index) => {
       const parts = line.split('|').map(s => s.trim());
       if (parts.length < 2) return null;

       const english = parts[0];
       const chinese = parts[1];
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

       return { english, chinese, note, progress, position, originalIndex: index };
    }).filter(item => item !== null) as Array<{
        english: string, chinese: string, note: string, progress: number, position: number | null, originalIndex: number
    }>;

    // Sort: Explicit Pos > Implicit Pos. For Equal Pos, use original line index.
    parsedItems.sort((a, b) => {
        const posA = a.position;
        const posB = b.position;
        
        if (posA !== null && posB === null) return -1;
        if (posA === null && posB !== null) return 1;

        if (posA !== null && posB !== null) {
            if (posA !== posB) return posA - posB;
            // Equal explicit positions: strict line order
            return a.originalIndex - b.originalIndex;
        }

        // Both implicit: strict line order
        return a.originalIndex - b.originalIndex;
    });

    const phrases: Phrase[] = parsedItems.map(item => {
       let correct = 0;
       let wrong = 0;
       if (item.progress > 0) correct = item.progress;
       if (item.progress < 0) wrong = Math.abs(item.progress);
       
       return {
          id: uuidv4(),
          english: item.english,
          chinese: item.chinese,
          note: item.note,
          consecutiveCorrect: correct,
          consecutiveWrong: wrong,
          totalReviews: correct + wrong
       };
    });

    if (phrases.length === 0) {
      setError("无法解析内容。请确保使用格式：英文 | 中文");
      return;
    }

    onImport(deckName, phrases);
  };

  const handleAiImport = async () => {
    if (!navigator.onLine) {
       setError("AI 生成需要网络连接，请检查您的网络设置。");
       return;
    }

    if (!deckName.trim() || !aiTopic.trim()) {
      setError("请输入词组本名称和主题。");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generatePhraseDeck(aiTopic);
      const phrases: Phrase[] = result.map(p => ({
        id: uuidv4(),
        ...p,
        consecutiveCorrect: 0,
        consecutiveWrong: 0,
        totalReviews: 0
      }));
      onImport(deckName, phrases);
    } catch (err) {
      setError("生成失败，请检查 API Key 或重试。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800">新建词组本</h2>
      </div>

      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          手动导入 (离线可用)
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'ai' ? 'bg-indigo-50 shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          AI 智能生成
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">词组本名称</label>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="例如：商务英语，四级核心词组..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {mode === 'manual' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">词组列表</label>
            <div className="bg-slate-50 p-3 rounded-md mb-2 border border-slate-200 text-xs text-slate-600">
               <p className="font-bold mb-1">输入格式：</p>
               <p>英文 | 中文 | 批注(选) | 进度(选) | 位置(选)</p>
               <p className="mt-1 text-slate-400">例如：</p>
               <p className="font-mono">Hello World | 你好[世界] | 批注</p>
               <p className="font-mono">Apple | 苹果 | | 5 | 0 (连对5次，排第1)</p>
            </div>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`Hello | 你好 | 常用问候语 | 0 | 0\nApple | 苹果\n...`}
              className="w-full h-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
            />
          </div>
        ) : (
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">主题 / 场景</label>
             <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="例如：机场对话，医疗术语，考研高频词组..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-indigo-700 font-medium">AI 智能生成</p>
                  <p className="text-xs text-indigo-600/80">
                    根据主题自动生成 10 个高质量词组。需要网络连接。
                  </p>
                </div>
              </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
            {!navigator.onLine && <WifiOff className="w-4 h-4" />}
            {error}
          </div>
        )}

        <div className="pt-4">
          <Button 
            onClick={mode === 'manual' ? handleManualImport : handleAiImport} 
            fullWidth 
            disabled={isLoading}
            variant={mode === 'ai' ? 'primary' : 'secondary'}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 生成中...
              </span>
            ) : (
              mode === 'manual' ? '开始导入' : '立即生成'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};