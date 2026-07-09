import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Sparkles,
  Send,
  BookOpen,
  GraduationCap,
  Layers,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { Button, Card, Badge, ChatBubble, LoadingSpinner } from '../components';
import { documentService } from '../services';
import { Document, Message, Summary, Citation } from '../types';
import { clsx } from 'clsx';

export const LearningSpacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdParam || '');
  const [activeTab, setActiveTab] = useState<'rag' | 'summary' | 'tutor'>('rag');

  // RAG Chat State
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Summary State
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryType, setSummaryType] = useState<'FULL' | 'CHAPTER'>('FULL');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Tutor State
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

  // Citation Preview Highlight in PDF Viewer
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const docs = await documentService.listDocuments();
        setDocuments(docs);
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      } catch {
        // Handle fetch error
      }
    };
    init();
  }, [selectedDocId]);

  useEffect(() => {
    if (selectedDocId) {
      setSearchParams({ docId: selectedDocId });
      setMessages([]);
      setActiveConversationId(`local-${selectedDocId}`);
    }
  }, [selectedDocId, setSearchParams]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'rag') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const convId = activeConversationId || `local-${selectedDocId || 'document'}`;

    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      conversationId: convId,
      role: 'user',
      content: inputMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: 'sys-' + Date.now(),
          conversationId: convId,
          role: 'assistant',
          content: 'AI chat/RAG is temporarily disabled. PDF upload and document storage are available.',
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsSending(false);
    }, 250);
  };

  const handleGenerateSummary = async (type: 'FULL' | 'CHAPTER', chapterIdx = 0) => {
    if (!selectedDocId) return;
    void type;
    void chapterIdx;
    setIsLoadingSummary(true);
    window.setTimeout(() => {
      setSummary(null);
      setIsLoadingSummary(false);
    }, 250);
  };

  const handleAskTutor = async (questionToAsk: string) => {
    if (!questionToAsk.trim() || isAskingTutor) return;
    setIsAskingTutor(true);
    window.setTimeout(() => {
      setTutorAnswer('AI tutor is temporarily disabled. PDF upload and Cognito sign-in are the active focus for this deployment.');
      setSuggestedQuestions([]);
      setIsAskingTutor(false);
    }, 250);
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  return (
    <div className="h-[calc(100vh-80px-64px)] flex flex-col lg:flex-row gap-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Left Panel: PDF Viewer / Textbook Reader (45% width) */}
      <Card className="lg:w-[45%] flex flex-col h-full p-0 overflow-hidden shadow-md">
        {/* Document Selector Header */}
        <div className="p-4 bg-[#232F3E] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="w-5 h-5 text-[#9CCAFF] shrink-0" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-[#181C1E] text-white border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold w-full focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  塘 {doc.title} ({doc.chunkCount} chunks)
                </option>
              ))}
            </select>
          </div>
          <Badge variant="ai" size="sm" className="ml-2 shrink-0">pgvector Ready</Badge>
        </div>

        {/* Simulated PDF Viewer Body */}
        <div className="flex-1 bg-[#F4F7F9] p-6 overflow-y-auto space-y-6 relative">
          {activeCitation && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-md animate-bounce">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
                <span>桃 Trﾃｭch d蘯ｫn ﾄ疎ng ch盻肱 (Trang {activeCitation.pageNumber || 1})</span>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="text-amber-900 hover:underline font-normal"
                >
                  ﾄ静ｳng v盻㏄ sﾃ｡ng
                </button>
              </div>
              <p className="text-xs italic text-amber-950 font-medium">&ldquo;{activeCitation.snippet}&rdquo;</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E0E3E5] space-y-4">
            <div className="border-b border-[#E0E3E5] pb-4 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#181C1E]">{currentDoc?.title || 'Tﾃi li盻㎡ giﾃ｡o trﾃｬnh AI'}</h3>
              <span className="text-xs font-semibold text-[#707882]">Trang 1 / 45</span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#404751]">
              <p className="font-bold text-sm text-[#232F3E]">Chﾆｰﾆ｡ng 1: Ki蘯ｿn trﾃｺc Hexagonal &amp; Retrieval-Augmented Generation (RAG)</p>
              <p>
                Trong phﾃ｡t tri盻ハ 盻ｩng d盻･ng AI hi盻㌻ ﾄ黛ｺ｡i, ki蘯ｿn trﾃｺc Ports &amp; Adapters (hay Hexagonal Architecture) ﾄ妥ｳng vai
                trﾃｲ t盻訴 quan tr盻肱g trong vi盻㌘ cﾃ｡ch ly logic nghi盻㎝ v盻･ c盻奏 lﾃｵi kh盻淑 s盻ｱ ph盻･ thu盻冂 vﾃo cﾆ｡ s盻・h蘯｡ t蘯ｧng bﾃｪn
                ngoﾃi...
              </p>
              <p>
                Cﾆ｡ ch蘯ｿ RAG cho phﾃｩp k蘯ｿt h盻｣p s盻ｩc m蘯｡nh c盻ｧa mﾃｴ hﾃｬnh ngﾃｴn ng盻ｯ l盻嬾 (LLM) nhﾆｰ Gemini 1.5 Pro v盻嬖 cﾆ｡ s盻・tri
                th盻ｩc c盻･c b盻・ Khi ngﾆｰ盻拱 dﾃｹng ﾄ黛ｺｷt cﾃ｢u h盻淑, h盻・th盻創g chuy盻ハ ﾄ黛ｻ品 cﾃ｢u h盻淑 thﾃnh vector nhﾃｺng thﾃｴng qua mﾃｴ
                hﾃｬnh embedding, sau ﾄ妥ｳ th盻ｱc hi盻㌻ tﾃｬm ki蘯ｿm k-NN trﾃｪn ch盻・m盻･c HNSW c盻ｧa pgvector ﾄ黛ｻ・trﾃｭch xu蘯･t ng盻ｯ c蘯｣nh.
              </p>
              <div className="p-3 bg-[#D0E4FF]/30 rounded-xl border-l-4 border-[#0073BB]">
                <p className="font-semibold text-[#00497A]">
                  東 ﾄ雪ｻ杵h lﾃｽ quan tr盻肱g: M盻冲 h盻・th盻創g RAG khﾃｴng cﾃｳ ch盻・m盻･c HNSW s蘯ｽ suy gi蘯｣m hi盻㎡ nﾄハg logarit khi dung
                  lﾆｰ盻｣ng tﾃi li盻㎡ vﾆｰ盻｣t quﾃ｡ 10,000 chunks.
                </p>
              </div>
              <p>
                ﾄ雪ｻ・ﾄ黛ｺ｣m b蘯｣o tﾃｭnh toﾃn v蘯ｹn d盻ｯ li盻㎡, cﾃ｡c tﾃ｡c v盻･ n蘯ｷng nhﾆｰ phﾃ｢n m蘯｣nh (chunking) vﾃ sinh vector ph蘯｣i ﾄ柁ｰ盻｣c ﾄ黛ｺｩy
                vﾃo hﾃng ﾄ黛ｻ｣i b蘯･t ﾄ黛ｻ渡g b盻・qu蘯｣n lﾃｽ b盻殃 Redis vﾃ BullMQ.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E0E3E5] space-y-4">
            <div className="border-b border-[#E0E3E5] pb-4 flex items-center justify-between">
              <span className="font-bold text-xs text-[#707882] uppercase tracking-wider">Chﾆｰﾆ｡ng 2: Ki盻ノ th盻ｭ t盻ｱ ﾄ黛ｻ冢g &amp; Quality Assurance</span>
              <span className="text-xs font-semibold text-[#707882]">Trang 12 / 45</span>
            </div>
            <p className="text-xs leading-relaxed text-[#404751]">
              Theo quy ﾄ黛ｻ杵h DEV_GUIDELINES.md c盻ｧa nhﾃｳm, m盻絞 thay ﾄ黛ｻ品 trong nghi盻㎝ v盻･ ch蘯･m ﾄ訴盻ノ tr蘯ｯc nghi盻㍊ ph蘯｣i ﾄ柁ｰ盻｣c
              ki盻ノ ch盻ｩng b蘯ｱng unit test ﾄ黛ｺ｡t 100% test coverage. Vi盻㌘ ki盻ノ th盻ｭ giﾃｺp lo蘯｡i b盻・hoﾃn toﾃn cﾃ｡c l盻擁 suy thoﾃ｡i
              (regression)...
            </p>
          </div>
        </div>
      </Card>

      {/* Right Panel: Interactive AI Workspace (55% width) */}
      <Card className="lg:w-[55%] flex flex-col h-full p-0 overflow-hidden shadow-md">
        {/* Navigation Tabs Header */}
        <div className="flex items-center bg-white border-b border-[#E0E3E5] px-6 h-16 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('rag')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all relative',
              activeTab === 'rag'
                ? 'bg-[#0073BB] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <MessageSquare size={16} />
            <span>Chat RAG Trﾃｭch d蘯ｫn</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('summary');
              if (!summary) handleGenerateSummary('FULL');
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all',
              activeTab === 'summary'
                ? 'bg-[#8A2BE2] text-white shadow-sm'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <Layers size={16} />
            <span>Tﾃｳm t蘯ｯt Map-Reduce</span>
          </button>

          <button
            onClick={() => setActiveTab('tutor')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all',
              activeTab === 'tutor'
                ? 'ai-gradient text-white shadow-sm ai-glow'
                : 'text-[#707882] hover:bg-[#F4F7F9] hover:text-[#181C1E]'
            )}
          >
            <GraduationCap size={16} />
            <span>Gia sﾆｰ AI 1-kﾃｨm-1</span>
          </button>
        </div>

        {/* Tab 1: RAG Chat Content */}
        {activeTab === 'rag' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#F4F7F9]/50">
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSelectCitation={(cite) => setActiveCitation(cite)}
                />
              ))}
              {isSending && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl w-fit shadow-sm border border-[#E0E3E5]">
                  <Sparkles className="w-4 h-4 text-[#8A2BE2] animate-spin" />
                  <span className="text-xs font-semibold text-[#404751] animate-pulse">
                    AI ﾄ疎ng tra c盻ｩu HNSW vector ﾄ黛ｻ・t盻貧g h盻｣p cﾃ｢u tr蘯｣ l盻拱...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#E0E3E5] flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="ﾄ雪ｺｷt cﾃ｢u h盻淑 v盻・tﾃi li盻㎡ (VD: Gi蘯｣i thﾃｭch cﾆ｡ ch蘯ｿ HNSW pgvector...)"
                disabled={isSending}
                className="flex-1 bg-[#F4F7F9] border border-[#E0E3E5] rounded-xl px-4 py-2.5 text-xs text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!inputMessage.trim() || isSending}
                className="px-5 shrink-0"
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        )}

        {/* Tab 2: Map-Reduce Summary Content */}
        {activeTab === 'summary' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F4F7F9]/50">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#E0E3E5] shadow-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant={summaryType === 'FULL' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('FULL');
                    handleGenerateSummary('FULL');
                  }}
                >
                  Tﾃｳm t蘯ｯt Toﾃn vﾄハ (Full Doc)
                </Button>
                <Button
                  variant={summaryType === 'CHAPTER' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSummaryType('CHAPTER');
                    handleGenerateSummary('CHAPTER', selectedChapter);
                  }}
                >
                  Tﾃｳm t蘯ｯt theo Chﾆｰﾆ｡ng
                </Button>
              </div>

              {summaryType === 'CHAPTER' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#707882]">Ch盻肱 chﾆｰﾆ｡ng:</span>
                  <select
                    value={selectedChapter}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedChapter(idx);
                      handleGenerateSummary('CHAPTER', idx);
                    }}
                    className="bg-[#F4F7F9] border border-[#E0E3E5] rounded-lg px-3 py-1 text-xs font-semibold text-[#181C1E]"
                  >
                    <option value={0}>Chﾆｰﾆ｡ng 1: T盻貧g quan RAG</option>
                    <option value={1}>Chﾆｰﾆ｡ng 2: Ki盻ノ th盻ｭ &amp; QA</option>
                    <option value={2}>Chﾆｰﾆ｡ng 3: T盻訴 ﾆｰu MinIO Storage</option>
                  </select>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={clsx(isLoadingSummary && 'animate-spin')} />}
                onClick={() => handleGenerateSummary(summaryType, selectedChapter)}
                disabled={isLoadingSummary}
              >
                T蘯｡o l蘯｡i
              </Button>
            </div>

            {isLoadingSummary ? (
              <Card className="p-16 flex items-center justify-center">
                <LoadingSpinner text="ﾄ紳ng th盻ｱc hi盻㌻ thu蘯ｭt toﾃ｡n Map-Reduce t盻貧g h盻｣p ﾃｽ chﾃｭnh..." variant="secondary" />
              </Card>
            ) : summary ? (
              <Card variant="ai-glow" className="p-8 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-[#E0E3E5] pb-4">
                  <h4 className="font-bold text-base text-[#181C1E] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#8A2BE2]" />
                    <span>{summary.chapterRef || summary.chapterTitle || 'B蘯｣n tﾃｳm t蘯ｯt toﾃn di盻㌻ tﾃi li盻㎡'}</span>
                  </h4>
                  <Badge variant="ai" size="sm">Map-Reduce Engine</Badge>
                </div>

                {/* Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#D0E4FF]/30 border border-[#0073BB]/20">
                    <p className="font-bold text-xs text-[#0073BB] mb-2">東 ﾄ進盻ノ chﾃｭnh:</p>
                    <ul className="space-y-1">
                      {summary.keyPoints.map((kp, i) => (
                        <li key={i} className="text-xs text-[#232F3E] flex items-start gap-2">
                          <span className="text-[#0073BB] font-bold shrink-0">{i + 1}.</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className="space-y-3 text-xs leading-relaxed text-[#404751] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: (summary.summaryText || summary.content || summary.summary || '')
                      .replace(/### (.*?)\n/g, '<h5 class="font-bold text-sm text-[#232F3E] mt-4 mb-2">$1</h5>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#181C1E]">$1</strong>'),
                  }}
                />
              </Card>
            ) : null}
          </div>
        )}

        {/* Tab 3: AI Tutor Content */}
        {activeTab === 'tutor' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F4F7F9]/50">
            <Card className="p-6 bg-gradient-to-br from-[#232F3E] to-[#0073BB] text-white space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  ｧ鯛昨沛ｫ
                </div>
                <div>
                  <h4 className="font-bold text-base">Gia sﾆｰ AI 1-kﾃｨm-1 (Chuyﾃｪn gia Hexagonal &amp; RAG)</h4>
                  <p className="text-xs text-[#9CCAFF]">H盻淑 b蘯･t c盻ｩ ﾄ訴盻「 gﾃｬ v盻・lﾃｽ thuy蘯ｿt, code convention ho蘯ｷc bﾃi t蘯ｭp</p>
                </div>
              </div>
            </Card>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskTutor(tutorQuestion);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={tutorQuestion}
                onChange={(e) => setTutorQuestion(e.target.value)}
                placeholder="Nh蘯ｭp cﾃ｢u h盻淑 cho gia sﾆｰ (VD: Lﾃm sao ﾄ黛ｻ・vi蘯ｿt mock adapter cho S3?)..."
                disabled={isAskingTutor}
                className="flex-1 bg-white border border-[#E0E3E5] rounded-xl px-4 py-3 text-xs text-[#181C1E] placeholder-[#707882] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]"
              />
              <Button type="submit" variant="ai" size="md" disabled={!tutorQuestion.trim() || isAskingTutor}>
                H盻淑 Gia sﾆｰ
              </Button>
            </form>

            {isAskingTutor ? (
              <Card className="p-12 flex items-center justify-center">
                <LoadingSpinner text="Gia sﾆｰ AI ﾄ疎ng so蘯｡n bﾃi hﾆｰ盻嬾g d蘯ｫn chi ti蘯ｿt..." variant="secondary" />
              </Card>
            ) : tutorAnswer ? (
              <Card className="p-6 space-y-4 bg-white border-l-4 border-l-[#8A2BE2]">
                <div
                  className="space-y-2 text-xs leading-relaxed text-[#181C1E] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: tutorAnswer.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#8A2BE2]">$1</strong>'),
                  }}
                />

                {suggestedQuestions.length > 0 && (
                  <div className="pt-4 border-t border-[#E0E3E5] space-y-2">
                    <p className="text-xs font-bold text-[#707882] flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-amber-500" /> Cﾃ｢u h盻淑 g盻｣i ﾃｽ ti蘯ｿp theo:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setTutorQuestion(q);
                            handleAskTutor(q);
                          }}
                          className="text-left p-2.5 rounded-xl bg-[#F4F7F9] hover:bg-[#EFDBFF]/40 text-xs font-medium text-[#404751] hover:text-[#8A2BE2] transition-colors flex items-center justify-between group"
                        >
                          <span>痩 {q}</span>
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  'Gi蘯｣i thﾃｭch s盻ｱ khﾃ｡c nhau gi盻ｯa HNSW vﾃ IVFFlat trong pgvector?',
                  'Lﾃm th蘯ｿ nﾃo ﾄ黛ｻ・vi蘯ｿt mock test ﾄ黛ｺ｡t 100% coverage cho quy trﾃｬnh ch蘯･m ﾄ訴盻ノ?',
                  'T蘯｡i sao business logic khﾃｴng ﾄ柁ｰ盻｣c phﾃｩp import tr盻ｱc ti蘯ｿp t盻ｫ AWS SDK?',
                  'Quy trﾃｬnh x盻ｭ lﾃｽ b蘯･t ﾄ黛ｻ渡g b盻・v盻嬖 worker BullMQ ho蘯｡t ﾄ黛ｻ冢g ra sao?',
                ].map((item, idx) => (
                  <Card
                    key={idx}
                    variant="interactive"
                    className="p-4 flex items-center justify-between text-xs font-medium text-[#404751] hover:text-[#8A2BE2]"
                    onClick={() => {
                      setTutorQuestion(item);
                      handleAskTutor(item);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-[#0073BB] shrink-0" />
                      {item}
                    </span>
                    <ChevronRight size={16} className="shrink-0" />
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
