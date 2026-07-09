import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Button, Card, Modal, Input, Badge, LoadingSpinner } from '../components';
import { documentService } from '../services';
import { Document } from '../types';
import { clsx } from 'clsx';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await documentService.listDocuments();
      const healedDocs = await Promise.all(
        docs.map(async (doc) => {
          if (doc.status !== 'uploading' && doc.status !== 'processing') {
            return doc;
          }

          try {
            return await documentService.completeDocument(doc.id);
          } catch {
            return doc;
          }
        })
      );
      setDocuments(healedDocs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocs();
  }, []);

  const openUploadModal = () => {
    setUploadError('');
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setIsUploadModalOpen(false);
    setUploadError('');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError('');
    try {
      const newDoc = await documentService.uploadDocument(selectedFile, docTitle);
      setDocuments((prev) => [newDoc, ...prev.filter((doc) => doc.id !== newDoc.id)]);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setDocTitle('');
      setUploadError('');
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document from your library?')) return;

    await documentService.deleteDocument(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const filteredDocuments = searchQuery.trim()
    ? documents.filter((doc) => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  return (
    <div className="mx-auto max-w-7xl animate-fadeIn space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card variant="ai-glow" className="flex flex-col justify-between bg-gradient-to-r from-[#0073BB] to-[#8A2BE2] p-6 text-white md:col-span-2">
          <div className="space-y-2">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
              PDF Library
            </span>
            <h2 className="text-2xl font-bold">Upload and store your study PDFs</h2>
            <p className="text-xs leading-relaxed text-white/80">
              Cognito sign-in and PDF upload are active. RAG, Bedrock, quiz generation, and AI chat are temporarily disabled for this deployment stage.
            </p>
          </div>
          <div className="pt-4">
            <Button
              data-testid="upload-button-banner"
              variant="outline"
              size="sm"
              className="border-none bg-white font-bold text-[#232F3E] shadow-md hover:bg-white/90"
              leftIcon={<UploadCloud size={16} />}
              onClick={openUploadModal}
            >
              Upload PDF
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-l-4 border-l-[#0073BB] p-6">
          <div className="flex items-center justify-between text-[#707882]">
            <span className="text-xs font-semibold uppercase">Documents</span>
            <FileText className="h-5 w-5 text-[#0073BB]" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-[#181C1E]">{documents.length}</span>
            <span className="ml-1.5 text-xs text-[#707882]">PDF files</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Stored in S3
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-l-4 border-l-[#8A2BE2] p-6">
          <div className="flex items-center justify-between text-[#707882]">
            <span className="text-xs font-semibold uppercase">Mode</span>
            <Clock className="h-5 w-5 text-[#8A2BE2]" />
          </div>
          <div className="mt-4">
            <span className="text-lg font-extrabold text-[#181C1E]">Upload Only</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-[#8A2BE2]">
            AI processing is paused
          </div>
        </Card>
      </div>

      <div className="space-y-4" data-testid="document-library">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#181C1E]">Document Library</h3>
            <p className="text-xs text-[#707882]">Uploaded PDFs are stored and listed here.</p>
          </div>
          <Button
            data-testid="upload-button"
            variant="primary"
            size="sm"
            leftIcon={<UploadCloud size={16} />}
            onClick={openUploadModal}
          >
            Upload document
          </Button>
        </div>

        <div className="relative">
          <input
            data-testid="document-search-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search documents by title..."
            className="w-full rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
          />
          {searchQuery && (
            <button
              data-testid="document-search-clear"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707882] hover:text-[#181C1E]"
            >
              Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <Card className="flex items-center justify-center p-16">
            <LoadingSpinner text="Loading documents..." />
          </Card>
        ) : documents.length === 0 ? (
          <Card data-testid="documents-empty-state" className="space-y-4 border-2 border-dashed border-[#C0C7D2] p-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D0E4FF]/40 text-[#0073BB]">
              <UploadCloud size={32} />
            </div>
            <div className="mx-auto max-w-md">
              <h4 className="text-base font-bold text-[#181C1E]">No documents yet</h4>
              <p className="mt-1 text-xs text-[#707882]">
                Upload your first PDF to verify the S3 and backend connection.
              </p>
            </div>
            <Button data-testid="upload-button-empty" variant="ai" size="md" onClick={openUploadModal}>
              Upload first PDF
            </Button>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card data-testid="documents-search-empty" className="space-y-4 border-2 border-dashed border-[#C0C7D2] p-16 text-center">
            <h4 className="text-base font-bold text-[#181C1E]">No matching documents</h4>
            <p className="text-xs text-[#707882]">Try another keyword or clear the search.</p>
          </Card>
        ) : (
          <div data-testid="document-list" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                data-testid={`document-card-${doc.id}`}
                variant="interactive"
                className="flex h-[230px] flex-col justify-between p-6"
                onClick={() => navigate(`/learning?docId=${doc.id}`)}
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F7F9] text-[#0073BB]">
                      <FileText size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status === 'ready' ? (
                        <Badge data-testid={`document-status-${doc.id}`} variant="success" size="sm">
                          <CheckCircle2 size={12} className="mr-1" /> Ready
                        </Badge>
                      ) : doc.status === 'processing' || doc.status === 'uploading' ? (
                        <Badge data-testid={`document-status-${doc.id}`} variant="warning" size="sm">
                          <Clock size={12} className="mr-1 animate-spin" /> Processing
                        </Badge>
                      ) : (
                        <Badge data-testid={`document-status-${doc.id}`} variant="error" size="sm">
                          <AlertCircle size={12} className="mr-1" /> Failed
                        </Badge>
                      )}
                      <button
                        data-testid={`delete-button-${doc.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(doc.id);
                        }}
                        className="rounded p-1 text-[#707882] transition-colors hover:bg-black/5 hover:text-[#BA1A1A]"
                        title="Delete document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 className="line-clamp-2 text-sm font-bold leading-snug text-[#181C1E] transition-colors group-hover:text-[#0073BB]">
                    {doc.title}
                  </h4>
                  <p className="mt-1 truncate text-xs text-[#707882]">
                    {doc.sizeBytes ? `${(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'PDF document'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[#E0E3E5] pt-4 text-xs text-[#707882]">
                  <span className="rounded bg-[#F4F7F9] px-2 py-0.5 font-medium">
                    {doc.status === 'ready' ? 'Stored' : 'Upload pending'}
                  </span>
                  <span className="font-medium text-[#0073BB]">Open</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        title="Upload Course Material (PDF)"
        size="md"
      >
        <form data-testid="upload-form" onSubmit={handleUploadSubmit} className="space-y-6">
          <Input
            data-testid="document-title-input"
            label="Document display name"
            placeholder="Example: SmartStudy AI on AWS"
            value={docTitle}
            onChange={(event) => setDocTitle(event.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#181C1E]">Choose a PDF from your computer</label>
            <div
              data-testid="file-drop-zone"
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all',
                selectedFile
                  ? 'border-[#0073BB] bg-[#0073BB]/5'
                  : 'border-[#C0C7D2] hover:border-[#0073BB] hover:bg-[#F4F7F9]'
              )}
            >
              <input
                ref={fileInputRef}
                data-testid="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D0E4FF] text-[#0073BB]">
                <UploadCloud size={24} />
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-[#0073BB]">{selectedFile.name}</p>
                  <p className="mt-0.5 text-xs text-[#707882]">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB - ready to upload
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-[#181C1E]">Click to choose or drag a PDF here</p>
                  <p className="mt-0.5 text-xs text-[#707882]">Maximum file size: 50MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] p-4 text-xs text-[#404751]">
            <p className="font-semibold text-[#181C1E]">Current deployment mode:</p>
            <p>1. The browser uploads the PDF directly to S3 using a presigned URL.</p>
            <p>2. The backend stores document metadata and marks the document ready.</p>
            <p>3. AI processing is intentionally paused for now.</p>
          </div>

          {uploadError && (
            <div className="rounded-lg bg-[#FFDAD6] p-3 text-xs font-medium text-[#93000A]">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              data-testid="upload-cancel-button"
              type="button"
              variant="outline"
              onClick={closeUploadModal}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              data-testid="upload-submit-button"
              type="submit"
              variant="ai"
              disabled={!selectedFile}
              isLoading={isUploading}
              leftIcon={<UploadCloud size={16} />}
            >
              Start upload
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
