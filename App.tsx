
import React, { useState, useEffect, useRef } from 'react';
import { processFileToQuestions } from './geminiService';
import { Question, QuizState, Certificate } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [history, setHistory] = useState<Certificate[]>([]);
  const [showCertificate, setShowCertificate] = useState(false);
  const [globalUsedTexts, setGlobalUsedTexts] = useState<string[]>([]);
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number>(180); // minutlarda, default 3 soat (180 min)
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('zahro_history');
    if (saved) setHistory(JSON.parse(saved));
    const savedTexts = localStorage.getItem('zahro_used_texts');
    if (savedTexts) setGlobalUsedTexts(JSON.parse(savedTexts));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (quiz && !quiz.isFinished && quiz.timeLeft > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setQuiz(prev => {
          if (!prev) return null;
          if (prev.timeLeft <= 1) {
            return { ...prev, timeLeft: 0, isFinished: true };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quiz?.isFinished, !!quiz]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateGrade = (score: number): Certificate['grade'] => {
    if (score >= 30) return 'A+';
    if (score >= 27) return 'A';
    if (score >= 25) return 'B+';
    if (score >= 22) return 'B';
    if (score >= 18) return 'C+';
    if (score >= 15) return 'C';
    return 'C';
  };

  const saveToHistory = (score: number, total: number, currentQuiz: QuizState) => {
    const grade = calculateGrade(score);
    const now = new Date();
    const expiry = new Date();
    expiry.setMonth(now.getMonth() + 3);

    const newCert: Certificate = {
      id: Math.random().toString(36).substr(2, 9),
      date: now.toLocaleDateString(),
      expiryDate: expiry.toLocaleDateString(),
      fileName: currentQuiz.originalFileName || "Noma'lum fayl",
      score,
      total,
      grade
    };
    const updated = [newCert, ...history];
    setHistory(updated);
    localStorage.setItem('zahro_history', JSON.stringify(updated));

    const newUsedTexts = [...globalUsedTexts, ...currentQuiz.questions.map(q => q.question)];
    setGlobalUsedTexts(newUsedTexts);
    localStorage.setItem('zahro_used_texts', JSON.stringify(newUsedTexts));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const questions = await processFileToQuestions(base64, file.type, globalUsedTexts);
        if (questions && questions.length > 0) {
          setQuiz({
            questions,
            currentQuestionIndex: 0,
            score: 0,
            isFinished: false,
            timeLeft: selectedTimeLimit * 60,
            userAnswers: {},
            originalFileBase64: base64,
            originalFileName: file.name,
            originalMimeType: file.type,
            usedQuestionTexts: questions.map(q => q.question)
          });
        } else {
          setError("Yangi savollar topilmadi.");
        }
      } catch (err: any) { 
        setError("Faylni tahlil qilishda xatolik.");
      } finally { setLoading(false); }
    };
  };

  const loadNextBatch = async () => {
    if (!quiz || !quiz.originalFileBase64 || !quiz.originalMimeType) return;
    setLoading(true);
    setError(null);
    setShowCertificate(false);
    try {
      const questions = await processFileToQuestions(
        quiz.originalFileBase64, 
        quiz.originalMimeType, 
        globalUsedTexts
      );
      if (questions && questions.length > 0) {
        setQuiz({
          ...quiz,
          questions,
          currentQuestionIndex: 0,
          score: 0,
          isFinished: false,
          timeLeft: selectedTimeLimit * 60,
          userAnswers: {},
          usedQuestionTexts: questions.map(q => q.question)
        });
      } else {
        setError("Boshqa yangi savollar qolmadi.");
        setQuiz(null);
      }
    } catch (err) {
      setError("Yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (qIndex: number, option: 'A' | 'B' | 'C' | 'D') => {
    if (quiz?.isFinished) return;
    setQuiz(prev => prev ? { ...prev, userAnswers: { ...prev.userAnswers, [qIndex]: option } } : null);
  };

  const finishQuiz = () => {
    if (!quiz) return;
    let finalScore = 0;
    quiz.questions.forEach((q, idx) => {
      if (quiz.userAnswers[idx] === q.correctAnswer) finalScore++;
    });
    const finishedQuiz = { ...quiz, score: finalScore, isFinished: true };
    setQuiz(finishedQuiz);
    if (timerRef.current) clearInterval(timerRef.current);
    // Avtomatik saqlash
    saveToHistory(finalScore, quiz.questions.length, finishedQuiz);
  };

  const resetQuiz = () => {
    setQuiz(null);
    setShowCertificate(false);
    setError(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center text-white bg-[#064e3b]">
      <header className="text-center mb-8">
        <h1 className="text-5xl font-bold text-amber-400 mb-2 drop-shadow-lg">Zahro AI</h1>
        <p className="text-emerald-200 uppercase tracking-widest text-sm">Sertifikatli Test Tizimi</p>
      </header>

      <main className="w-full max-w-4xl">
        {!quiz && !loading && (
          <div className="space-y-6">
            <div className="emerald-card rounded-[2.5rem] p-10 shadow-2xl border border-amber-500/40 text-center">
              <h2 className="text-2xl font-bold text-amber-400 mb-4">Test Sozlamalari</h2>
              
              <div className="mb-6 max-w-xs mx-auto">
                <label className="block text-emerald-300 text-sm mb-2 font-bold uppercase">Vaqtni tanlang (minut):</label>
                <select 
                  value={selectedTimeLimit} 
                  onChange={(e) => setSelectedTimeLimit(parseInt(e.target.value))}
                  className="w-full bg-emerald-900 border-2 border-amber-500/30 rounded-xl p-3 text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value={30}>30 minut</option>
                  <option value={60}>1 soat</option>
                  <option value={120}>2 soat</option>
                  <option value={180}>3 soat</option>
                  <option value={300}>5 soat</option>
                </select>
              </div>

              <label className="gold-gradient text-[#064e3b] font-black py-5 px-14 rounded-2xl cursor-pointer hover:scale-105 transition-all inline-block shadow-xl border-2 border-[#fbbf24]">
                FAYL YUKLASH VA BOSHLASH
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,image/*" />
              </label>
              {error && <p className="mt-4 text-red-300 bg-red-900/40 p-3 rounded-lg border border-red-500/50">{error}</p>}
            </div>

            <div className="emerald-card rounded-[2rem] p-8 border border-amber-500/20">
              <h3 className="text-xl font-bold text-amber-400 mb-6">Sertifikatlar Tarixi</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {history.map(cert => (
                  <div key={cert.id} className="p-4 bg-emerald-900/40 rounded-xl border border-white/5 flex justify-between">
                    <div>
                      <p className="font-bold text-amber-400">{cert.grade} Sertifikati</p>
                      <p className="text-xs text-emerald-300 truncate max-w-[200px]">{cert.fileName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-white">{cert.score}/{cert.total}</p>
                      <p className="text-[10px] opacity-40">{cert.date}</p>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <p className="text-emerald-500 italic opacity-50">Tarix bo'sh</p>}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-24 emerald-card rounded-[2.5rem] border border-amber-500/30 animate-pulse">
            <div className="w-20 h-20 border-8 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-3xl font-black text-amber-400 mb-2">SAVOLLAR TAYYORLANMOQDA</h2>
            <p className="text-emerald-300 font-bold uppercase tracking-widest text-sm">Iltimos, kutib turing...</p>
          </div>
        )}

        {quiz && !loading && !showCertificate && (
          <div className="space-y-6 pb-20">
            <div className="sticky top-4 z-50 flex justify-between items-center emerald-card p-4 rounded-2xl border-amber-500/50 shadow-2xl">
              <div className="text-amber-400 font-mono text-xl">{formatTime(quiz.timeLeft)}</div>
              <div className="text-emerald-400 font-bold">30 talik to'plam</div>
              {quiz.isFinished && (
                 <div className="text-white font-black bg-amber-600 px-4 py-1 rounded-lg">Ball: {quiz.score}/30</div>
              )}
            </div>

            {quiz.questions.map((q, idx) => {
              const userAns = quiz.userAnswers[idx];
              return (
                <div key={idx} className="emerald-card rounded-[1.5rem] p-6 border border-white/10">
                  <h3 className="text-xl font-bold mb-6 break-words">{idx + 1}. {q.question}</h3>
                  <div className="grid gap-3">
                    {Object.entries(q.options).map(([key, val]) => {
                      const isCorrect = key === q.correctAnswer;
                      const isSelected = userAns === key;
                      let btnCls = "w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 break-words ";
                      if (!quiz.isFinished) btnCls += isSelected ? "border-amber-400 bg-amber-400/10" : "border-white/5 hover:border-white/20";
                      else {
                        if (isCorrect) btnCls += "border-green-500 bg-green-500/20";
                        else if (isSelected) btnCls += "border-red-500 bg-red-500/20";
                        else btnCls += "border-white/5 opacity-50";
                      }
                      return (
                        <button key={key} disabled={quiz.isFinished} onClick={() => handleSelectAnswer(idx, key as any)} className={btnCls}>
                          <b className="w-7 h-7 flex-shrink-0 rounded border border-amber-500/40 flex items-center justify-center text-amber-400">{key}</b>
                          <span className="flex-1">{val}</span>
                        </button>
                      );
                    })}
                  </div>
                  {quiz.isFinished && (
                    <div className="mt-4 p-4 bg-white/5 rounded-xl border-l-4 border-amber-500 text-sm">
                      <span className="font-bold text-amber-400">Izoh:</span> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {!quiz.isFinished ? (
              <button onClick={finishQuiz} className="w-full gold-gradient py-6 rounded-[2rem] text-emerald-950 font-black text-2xl shadow-2xl hover:scale-[1.02] transition-all">
                TESTNI YAKUNLASH
              </button>
            ) : (
              <div className="grid gap-4">
                <button onClick={() => setShowCertificate(true)} className="w-full gold-gradient py-6 rounded-[2rem] text-emerald-950 font-black text-2xl shadow-2xl">
                  SERTIFIKATNI KO'RISH
                </button>
                <button onClick={loadNextBatch} className="w-full bg-emerald-700/50 border-2 border-amber-500/30 py-5 rounded-[2rem] font-black text-xl hover:bg-emerald-700">
                  KEYINGI 30 TALIK (YANGI SAVOLLAR)
                </button>
                <button onClick={resetQuiz} className="w-full bg-white/10 py-4 rounded-[2rem] font-bold">ASOSIY MENYU</button>
              </div>
            )}
          </div>
        )}

        {showCertificate && quiz && (
          <div className="emerald-card rounded-[2.5rem] p-12 text-center border-4 border-amber-500 relative">
            <h2 className="text-3xl font-serif text-amber-400 mb-2 uppercase tracking-[0.2em]">Sertifikat</h2>
            <div className="w-24 h-24 mx-auto my-8 gold-gradient rounded-full flex items-center justify-center text-4xl font-black text-emerald-950 shadow-2xl">
               {calculateGrade(quiz.score)}
            </div>
            <p className="text-emerald-100 mb-2">ZAHRO AI MASTERI</p>
            <div className="bg-white/5 p-8 rounded-3xl mb-8">
               <p className="text-amber-400 font-bold mb-2">Daraja: {calculateGrade(quiz.score)}</p>
               <p className="text-white text-3xl font-black mb-4">{quiz.score} / {quiz.questions.length}</p>
               <p className="text-[10px] text-emerald-400 uppercase">Avtomatik saqlandi</p>
            </div>
            <div className="grid gap-4">
              <button onClick={loadNextBatch} className="gold-gradient w-full py-5 rounded-2xl text-emerald-950 font-black text-xl shadow-xl">KEYINGI 30 TALIKNI BOSHLASH</button>
              <button onClick={resetQuiz} className="bg-white/10 w-full py-4 rounded-2xl font-bold">ASOSIY MENYU</button>
            </div>
          </div>
        )}
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.4); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
