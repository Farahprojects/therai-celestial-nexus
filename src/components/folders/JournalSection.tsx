import React from 'react';
import { MoreHorizontal } from 'lucide-react';
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

        <div className="flex flex-col space-y-2">
          {journals.map(journal => (
            <div
              key={journal.id}
              className="flex items-start justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                {!!journal.title && (
                  <p className="text-sm font-light text-gray-900 mb-0.5 truncate">
                    {journal.title}
                  </p>
                )}
                <p className="text-sm font-light text-gray-900 mb-0.5">
                  {journal.entry_text}
                </p>
                <p className="text-xs font-light text-gray-500">
                  {new Date(journal.created_at).toLocaleDateString()}
                </p>
              </div>

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
          ))}
        </div>
      </div>
    </div>
  );
};
