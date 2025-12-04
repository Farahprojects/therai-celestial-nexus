import React, { useState, useEffect } from 'react';
import { useUserMemory } from '@/hooks/useUserMemory';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Trash2, Download, Calendar } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  goal: 'Goal',
  pattern: 'Pattern',
  emotion: 'Emotion',
  fact: 'Fact',
  relationship: 'Relationship'
};

export function MemoryPanel() {
  const { memories, summaries, loading } = useUserMemory();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  // Optimistic updates: track deleted IDs to hide them immediately
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Clean up deletedIds when memories are refetched (remove IDs that are no longer in memories)
  useEffect(() => {
    if (deletedIds.size > 0) {
      const memoryIds = new Set(memories.map((m: any) => m.id));
      setDeletedIds(prev => {
        const next = new Set<string>();
        for (const id of Array.from(prev)) {
          // Only keep IDs that are still in memories (means delete hasn't completed yet or failed)
          // If ID is not in memories, it was successfully deleted, so remove from Set
          if (memoryIds.has(id)) {
            next.add(id);
          }
        }
        return next;
      });
    }
  }, [memories]);

  // Filter out optimistically deleted memories
  const visibleMemories = memories.filter((m: any) => !deletedIds.has(m.id));

  const filteredMemories = visibleMemories.filter((m: any) => {
    const matchesSearch = m.memory_text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || m.memory_type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id: string) => {
    // Optimistically remove from UI immediately
    setDeletedIds(prev => new Set(prev).add(id));

    const updatePayload = {
      deleted_at: new Date().toISOString(),
      is_active: false,
    } satisfies TablesUpdate<'user_memory'>;

    const memoryId = id as Tables<'user_memory'>['id'];

    const { error } = await supabase
      .from('user_memory')
      .update(updatePayload)
      .eq('id' satisfies keyof Tables<'user_memory'>, memoryId);

    if (error) {
      // Restore memory on error
      setDeletedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error('Failed to delete memory');
    } else {
      toast.success('Memory deleted');
      // No refetch needed - memory is already removed optimistically
      // The cleanup effect will remove the ID from deletedIds when memories are next fetched
    }
  };

  const handleExport = async () => {
    const exportData = {
      memories: memories.map((m: any) => ({
        text: m.memory_text,
        type: m.memory_type,
        created: m.created_at
      })),
      monthly_summaries: summaries
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Memory data exported');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-light text-gray-900">Your Memories</h3>
          <p className="text-sm text-gray-600 mt-1">
            Insights extracted from conversations with your primary profile
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={handleExport}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          type="text"
          placeholder="Search memories..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-full bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="goal">Goals</option>
          <option value="pattern">Patterns</option>
          <option value="emotion">Emotions</option>
          <option value="fact">Facts</option>
          <option value="relationship">Relationships</option>
        </select>
      </div>

      {filteredMemories.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-light text-gray-900 mb-1">
            {searchTerm || filterType !== 'all' 
              ? 'No memories match your filters'
              : 'No memories yet'}
          </h4>
          <p className="text-sm text-gray-600">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Chat with your primary profile to start building your memory'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMemories.map((mem: any) => (
            <div
              key={mem.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                      {TYPE_LABELS[mem.memory_type] || mem.memory_type}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(mem.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 leading-relaxed">{mem.memory_text}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full flex-shrink-0"
                  onClick={() => handleDelete(mem.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-gray-100">
          <div>
            <h3 className="text-lg font-light text-gray-900">Monthly Summaries</h3>
            <p className="text-sm text-gray-600 mt-1">
              Long-term patterns and growth insights
            </p>
          </div>
          <div className="space-y-3">
            {summaries.map((summary: any) => (
              <div
                key={summary.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <h4 className="font-medium text-gray-900">
                    {new Date(summary.year, summary.month - 1).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </h4>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                  {summary.emotional_summary}
                </p>
                {summary.key_themes && summary.key_themes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {summary.key_themes.map((theme: any, i: number) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-medium"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

