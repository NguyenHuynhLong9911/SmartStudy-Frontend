import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { Badge, Button, Card, LoadingSpinner } from '../components';
import { documentService } from '../services';
import { Document } from '../types';

export const LearningSpacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(docIdParam || '');
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const docs = await documentService.listDocuments();
        setDocuments(docs);
        if (!selectedDocId && docs[0]) {
          setSelectedDocId(docs[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      setSearchParams({ docId: selectedDocId });
    }
  }, [selectedDocId, setSearchParams]);

  const currentDoc = documents.find((doc) => doc.id === selectedDocId) || documents[0];

  useEffect(() => {
    const loadPreview = async () => {
      setPreviewUrl('');
      setPreviewError('');

      if (!currentDoc || currentDoc.status !== 'ready') {
        return;
      }

      setIsPreviewLoading(true);
      try {
        const url = await documentService.getDownloadUrl(currentDoc.id);
        setPreviewUrl(url);
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : 'Could not load PDF preview.');
      } finally {
        setIsPreviewLoading(false);
      }
    };

    void loadPreview();
  }, [currentDoc?.id, currentDoc?.status]);

  if (isLoading) {
    return (
      <Card className="mx-auto flex max-w-4xl items-center justify-center p-16">
        <LoadingSpinner text="Loading documents..." />
      </Card>
    );
  }

  if (!currentDoc) {
    return (
      <Card className="mx-auto max-w-4xl space-y-4 border-2 border-dashed border-[#C0C7D2] p-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D0E4FF]/40 text-[#0073BB]">
          <UploadCloud size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#181C1E]">No documents available</h2>
        <p className="text-sm text-[#707882]">Upload a PDF from the dashboard first.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#0073BB]" />
          <h2 className="text-base font-bold text-[#181C1E]">Documents</h2>
        </div>

        <div className="space-y-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                doc.id === currentDoc.id
                  ? 'border-[#0073BB] bg-[#D0E4FF]/40'
                  : 'border-[#E0E3E5] bg-white hover:bg-[#F4F7F9]'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0073BB]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#181C1E]">{doc.title}</p>
                  <p className="mt-1 text-xs text-[#707882]">{doc.status}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant={currentDoc.status === 'ready' ? 'success' : 'warning'} size="sm">
                {currentDoc.status === 'ready' ? (
                  <CheckCircle2 size={12} className="mr-1" />
                ) : (
                  <Info size={12} className="mr-1" />
                )}
                {currentDoc.status}
              </Badge>
              <h1 className="text-2xl font-bold text-[#181C1E]">{currentDoc.title}</h1>
              <p className="text-sm text-[#707882]">
                {currentDoc.sizeBytes ? `${(currentDoc.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'PDF document'}
              </p>
            </div>

            {previewUrl && (
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ExternalLink size={14} />}
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
              >
                Open PDF
              </Button>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#E0E3E5] px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#0073BB]" />
              <h2 className="text-lg font-bold text-[#181C1E]">PDF Preview</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={async () => {
                if (!currentDoc || currentDoc.status !== 'ready') return;
                setIsPreviewLoading(true);
                setPreviewError('');
                try {
                  setPreviewUrl(await documentService.getDownloadUrl(currentDoc.id));
                } catch (error) {
                  setPreviewError(error instanceof Error ? error.message : 'Could not refresh PDF preview.');
                } finally {
                  setIsPreviewLoading(false);
                }
              }}
            >
              Refresh
            </Button>
          </div>

          <div className="h-[720px] bg-[#F4F7F9]">
            {isPreviewLoading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner text="Loading PDF preview..." />
              </div>
            ) : previewError ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-2">
                  <Info className="mx-auto h-8 w-8 text-[#BA1A1A]" />
                  <h3 className="text-base font-bold text-[#181C1E]">Preview unavailable</h3>
                  <p className="text-sm text-[#707882]">{previewError}</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                title={`PDF preview: ${currentDoc.title}`}
                src={previewUrl}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-2">
                  <Info className="mx-auto h-8 w-8 text-[#8A2BE2]" />
                  <h3 className="text-base font-bold text-[#181C1E]">No preview yet</h3>
                  <p className="text-sm text-[#707882]">
                    The PDF must be in Ready status before the app can generate a secure preview link.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#8A2BE2]" />
            <h2 className="text-lg font-bold text-[#181C1E]">Text extraction is not enabled yet</h2>
          </div>
          <p className="text-sm leading-relaxed text-[#404751]">
            This preview shows the original PDF file stored in S3. Searchable extracted text, summaries, chat, and quizzes will require a later PDF parser or AI/RAG processing step.
          </p>
        </Card>
      </div>
    </div>
  );
};
