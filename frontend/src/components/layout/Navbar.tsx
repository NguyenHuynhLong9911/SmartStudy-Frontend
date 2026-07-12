import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '../common';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const getPageTitle = (pathname: string): { title: string; subtitle: string } => {
    if (pathname.startsWith('/dashboard')) {
      return {
        title: 'Dashboard & Document Library',
        subtitle: 'Manage PDF uploads and verify the AWS backend connection.',
      };
    }
    if (pathname.startsWith('/learning')) {
      return {
        title: 'Learning Space',
        subtitle: 'AI chat and RAG are temporarily disabled while upload is being stabilized.',
      };
    }
    if (pathname.startsWith('/exam-center')) {
      return {
        title: 'Exam Center',
        subtitle: 'Quiz and exam generation are paused until AI processing is enabled.',
      };
    }
    if (pathname.startsWith('/study-tools')) {
      return {
        title: 'Study Tools',
        subtitle: 'Focus timer, notes, checklist, and flashcards.',
      };
    }
    if (pathname.startsWith('/results')) {
      return {
        title: 'Results',
        subtitle: 'Assessment analysis is paused for this deployment stage.',
      };
    }
    return {
      title: 'SmartStudy',
      subtitle: 'Cognito sign-in and PDF upload on AWS.',
    };
  };

  const { title, subtitle } = getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#E0E3E5] bg-white/80 px-8 shadow-sm backdrop-blur-md">
      <div>
        <h1 className="flex items-center gap-2.5 text-xl font-bold text-[#181C1E]">
          {title}
          <Badge variant="ai" size="sm">
            <Sparkles className="mr-1 inline h-3 w-3 text-[#8A2BE2]" />
            Upload Mode
          </Badge>
        </h1>
        <p className="mt-0.5 text-xs text-[#707882]">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 lg:flex">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>AWS connected</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </div>

        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707882]" />
          <input
            type="text"
            placeholder="Search documents..."
            className="w-64 rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] py-2 pl-9 pr-4 text-xs text-[#181C1E] placeholder-[#707882] transition-all focus:border-[#0073BB] focus:outline-none focus:ring-2 focus:ring-[#0073BB]/30"
          />
        </div>

        <button
          className="relative rounded-xl bg-[#F4F7F9] p-2.5 text-[#404751] transition-colors hover:bg-[#D0E4FF]/40 hover:text-[#0073BB]"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#BA1A1A]" />
        </button>
      </div>
    </header>
  );
};
