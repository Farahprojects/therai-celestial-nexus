import React from 'react';
import { MoreHorizontal, BookOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { JournalEntry } from '@/services/journal';

interface JournalSectionProps {
  journals: JournalEntry[];
  onEditJournal: (journal: JournalEntry) => void;
  onDeleteJournal: (journalId: string) => void;
}

export const JournalSection: React.FC<JournalSectionProps> = ({
  journals,
  onEditJournal,
  onDeleteJournal,
}) => {
  if (journals.length === 0) return null;

  return (
    <div className="px-6 py-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Journal
          </p>
        </div>

        <div className="flex flex-col space-y-1">
          {journals.map(journal => {
            // Truncate text preview to ~50 characters
            const textPreview = journal.entry_text.length > 50
              ? journal.entry_text.substring(0, 50) + '...'
              : journal.entry_text;

            return (
              <div
                key={journal.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                {/* Icon */}
                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />

                {/* Content - single line */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {/* Title if exists */}
                  {journal.title && (
                    <>
                      <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                        {journal.title}
                      </span>
                      <span className="text-gray-300">—</span>
                    </>
                  )}

                  {/* Text preview */}
                  <span className="text-sm text-gray-600 truncate">
                    {textPreview}
                  </span>
                </div>

                {/* Date */}
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {new Date(journal.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors" aria-label="Journal actions">
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <button
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                      onClick={() => onEditJournal(journal)}
                    >
                      Edit
                    </button>
                    <button
                      className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-gray-100 rounded"
                      onClick={() => onDeleteJournal(journal.id)}
                    >
                      Delete
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
