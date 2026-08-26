import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import QuerySection from './components/QuerySection';
import MetricCards from './components/MetricCards';
import SubmissionsList from './components/SubmissionsList';
import HistorySidebar from './components/HistorySidebar';
import AuthPage from './pages/AuthPage';
import { useAuth } from './context/AuthContext';
import { queryAPI, explainStreamAPI, getHistoryAPI, searchHistoryAPI } from './services/api';

function App() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null);
  const [streamText, setStreamText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetchHistory();
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [user, searchQuery, currentPage]);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      if (searchQuery.trim()) {
        const res = await searchHistoryAPI(searchQuery, currentPage);
        // Map Typesense hits to our standard history object
        const mappedHistory = res.hits.map(h => ({
          id: h.document.id,
          query: h.document.query,
          mode: h.document.mode,
          timestamp: h.document.timestamp,
          // If we want the full data/answer we might need to fetch it from backend or store it in Typesense. 
          // For now, Typesense just acts as a list view. To restore full, we might need a separate GET by ID, 
          // but let's assume we can re-query if clicked, or just show the prompt for now if we didn't index full dataJSON.
        }));
        setHistory(mappedHistory);
        setTotalPages(Math.ceil((res.found || 1) / 10));
      } else {
        const hist = await getHistoryAPI();
        // Manual pagination for standard Neo4j history
        const perPage = 10;
        setTotalPages(Math.ceil(hist.length / perPage) || 1);
        setHistory(hist.slice((currentPage - 1) * perPage, currentPage * perPage));
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleSelectHistoryItem = async (item) => {
    // If it's from Typesense, we might not have `answer` and `data` mapped.
    // If it has answer, restore it instantly.
    if (item.answer) {
      setStreamText(item.answer || "");
      setMode(item.mode);
      setData(item.data);
    } else {
      // If we clicked a Typesense search result, just re-run the query
      setSearchQuery("");
      handleAsk(item.query);
    }
  };

  const handleAsk = async (query) => {
    setIsLoading(true);
    setStreamText("");
    setData(null);
    setMode(null);
    
    try {
      const res = await queryAPI(query);
      setData(res.result);
      setMode(res.mode);
      
      await explainStreamAPI(
        query, 
        res.mode, 
        res.result,
        (chunk) => {
          setStreamText(prev => prev + chunk);
        },
        () => {
          setIsLoading(false);
          setTimeout(() => fetchHistory(), 1000);
        },
        (errorMsg) => {
          setStreamText(prev => prev + "\n\n**Error:** " + errorMsg);
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setStreamText("**Error:** Could not connect to backend.");
      setIsLoading(false);
    }
  };

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pb-20">
      <div className="max-w-[1500px] mx-auto px-4">
        <Navbar />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="hidden lg:block lg:col-span-3 xl:col-span-2 h-[calc(100vh-140px)] sticky top-24">
            <HistorySidebar 
              history={history} 
              onSelectHistory={handleSelectHistoryItem}
              searchQuery={searchQuery}
              setSearchQuery={(val) => { setSearchQuery(val); setCurrentPage(1); }}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-5 h-[calc(100vh-140px)] sticky top-24 flex flex-col">
            <QuerySection 
              onAsk={handleAsk} 
              isLoading={isLoading} 
              streamText={streamText}
              mode={mode}
            />
          </div>

          <div className="lg:col-span-4 xl:col-span-5">
            {isLoading && !data ? (
              <div className="animate-in fade-in h-full flex flex-col gap-4">
                {/* Metric Cards Skeleton */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse"></div>
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse"></div>
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse"></div>
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse"></div>
                </div>
                {/* List Skeleton */}
                <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse p-4 flex flex-col gap-3">
                  <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-2"></div>
                  <div className="h-16 bg-slate-700/30 rounded-lg"></div>
                  <div className="h-16 bg-slate-700/30 rounded-lg"></div>
                  <div className="h-16 bg-slate-700/30 rounded-lg"></div>
                </div>
              </div>
            ) : data ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MetricCards data={data} mode={mode} />
                <SubmissionsList data={data} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 min-h-[400px] border border-dashed border-slate-800 rounded-xl glass-panel">
                <p>Dashboard waiting for query...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
