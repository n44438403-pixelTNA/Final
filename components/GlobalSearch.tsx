import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Volume2, Globe, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onClose: () => void;
  isDarkMode: boolean;
  onOpenAiTutor?: () => void;
}

interface WikipediaResult {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  pageid: number;
}

export const GlobalSearch: React.FC<Props> = ({ onClose, isDarkMode, onOpenAiTutor }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikipediaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Use Wikipedia API for robust general knowledge (English)
      let response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&utf8=&format=json&origin=*`
      );
      let data = await response.json();
      let lang = 'en';

      // Fallback to Hindi Wikipedia
      if (!data.query?.search?.length) {
        response = await fetch(
          `https://hi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            query
          )}&utf8=&format=json&origin=*`
        );
        data = await response.json();
        lang = 'hi';
      }

      if (data.query?.search?.length > 0) {
        // Fetch detailed extracts for top 3 results (removed exintro=1 to get full article)
        const pageIds = data.query.search.slice(0, 3).map((r: any) => r.pageid).join('|');
        const detailResponse = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&explaintext=1&piprop=thumbnail&pithumbsize=200&pageids=${pageIds}&format=json&origin=*`
        );
        const detailData = await detailResponse.json();

        let detailedResults = Object.values(detailData.query.pages) as WikipediaResult[];

        // Clean up Wikipedia's formatting artifacts (e.g. == Heading ==)
        detailedResults = detailedResults.map(res => {
            let cleanText = res.extract || '';
            // Remove == and === headings, converting them to normal newlines or just bold-like text if we could,
            // but for simple text, let's just strip the '=' signs and add spacing
            cleanText = cleanText.replace(/={2,}([^=]+)={2,}/g, '\n\n$1\n');
            // Remove excessive newlines (more than 2)
            cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
            // Trim
            cleanText = cleanText.trim();

            return {
                ...res,
                extract: cleanText
            };
        });

        setResults(detailedResults);
        setTranslatedTexts({}); // Reset translations on new search
      } else {
        setResults([]);
        setError("No results found. Try a different topic.");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to fetch results. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string, id: string) => {
    if (speaking === id) {
      window.speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Try to get an English or Indian voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-IN')) || voices.find(v => v.lang.includes('en'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => setSpeaking(null);
    utterance.onerror = () => setSpeaking(null);

    setSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  const translateToHindi = async (text: string, id: string) => {
    if (translatedTexts[id]) {
      // Toggle back to English (or just remove translation state)
      const newTranslations = { ...translatedTexts };
      delete newTranslations[id];
      setTranslatedTexts(newTranslations);
      return;
    }

    setTranslating(id);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      const translated = data[0].map((x: any) => x[0]).join('');
      setTranslatedTexts(prev => ({ ...prev, [id]: translated }));
    } catch (err) {
      console.error("Translation error:", err);
      // Optional: show a small error toast or ignore
    } finally {
      setTranslating(null);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100000] bg-slate-900/40 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="w-full max-w-2xl mx-auto flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Bar Container */}
          <div className="bg-white rounded-3xl p-2 shadow-2xl flex items-center gap-1 sm:gap-2 relative z-10 border border-slate-100 overflow-hidden">
            <Search className="text-slate-400 ml-2 sm:ml-4 shrink-0" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search concepts, formulas..."
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-base sm:text-xl font-medium text-slate-800 p-2 placeholder-slate-400 outline-none"
            />
            <button
              onClick={handleSearch}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-2xl font-bold shadow-md transition-all active:scale-95 text-sm sm:text-base"
            >
              Search
            </button>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 ml-1 sm:ml-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Results Area */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-h-[70vh] flex flex-col">
            {loading && (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <BrainCircuit className="w-12 h-12 animate-pulse mb-4 text-blue-500" />
                <p className="font-medium animate-pulse">Searching the global knowledge base...</p>
              </div>
            )}

            {!loading && error && (
              <div className="p-8 text-center text-red-500 font-medium bg-red-50/50">
                {error}
              </div>
            )}

            {!loading && !error && results.length > 0 && (
              <div className="overflow-y-auto p-4 custom-scrollbar">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <Globe className="text-blue-600" size={18} />
                  <span className="text-sm font-bold text-slate-600 tracking-wide">TOP RESULTS</span>
                </div>

                <div className="space-y-4">
                  {results.map((res) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={res.pageid}
                      className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-blue-200 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900 mb-2">{res.title}</h3>
                          <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                            {translatedTexts[res.pageid] || res.extract}
                          </p>
                        </div>
                        {res.thumbnail && (
                          <img
                            src={res.thumbnail.source}
                            alt={res.title}
                            className="w-24 h-24 object-cover rounded-xl shadow-sm hidden sm:block"
                          />
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => speakText(translatedTexts[res.pageid] || res.extract, res.pageid.toString())}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            speaking === res.pageid.toString()
                              ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Volume2 size={16} className={speaking === res.pageid.toString() ? 'animate-pulse' : ''} />
                          {speaking === res.pageid.toString() ? 'Stop Listening' : 'Listen'}
                        </button>

                        <button
                          onClick={() => translateToHindi(res.extract, res.pageid.toString())}
                          disabled={translating === res.pageid.toString()}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            translatedTexts[res.pageid]
                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          } ${translating === res.pageid.toString() ? 'opacity-70 cursor-wait' : ''}`}
                        >
                          <span className="font-serif">अ</span>
                          {translating === res.pageid.toString()
                            ? 'Translating...'
                            : translatedTexts[res.pageid]
                              ? 'Show English'
                              : 'Translate to Hindi'
                          }
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && results.length === 0 && query && (
               <div className="p-8 text-center text-slate-500 font-medium">
                  Press Enter or Search to find information.
               </div>
            )}

            {/* AI Doubt Solver Banner */}
            {!loading && query && (
              <div className="p-4 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Didn't find what you're looking for?</h4>
                    <p className="text-xs text-slate-600">Ask the Smart Doubt Solver (AI)</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                     onClose();
                     if (onOpenAiTutor) onOpenAiTutor();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  Ask AI
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
