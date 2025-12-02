
export interface ParsedBlock {
  type: 'heading' | 'action' | 'tag' | 'spacer' | 'normal';
  text: string;
}

export class ReportParser {
  static cleanContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/[_`]/g, '')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove error messages that shouldn't be displayed
      .replace(/[",]\s*"?reporterror"?\s*:\s*"[^"]*"/gi, '')
      .replace(/Failed to generate \w+ report: [^}]*/gi, '')
      .trim();
  }

  static processBlocks(content: string): ParsedBlock[] {
    const lines = content.split(/\r?\n/); // PRESERVE blank lines
    const out: ParsedBlock[] = [];

    lines.forEach(raw => {
      const line = raw.trim();
      if (line === '') {
        out.push({ type: 'spacer', text: '' });
        return;
      }
      const lower = line.toLowerCase();

      if (this.isHeading(line)) {
        out.push({ type: 'heading', text: line });
        return;
      }
      if (lower.startsWith('positivetags:') || lower.startsWith('negativetags:')) {
        const lbl = lower.startsWith('positivetags:') ? 'Positive Traits' : 'Negative Traits';
        out.push({ type: 'heading', text: lbl });
        line.split(':')[1].split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          out.push({ type: 'tag', text: `• ${tag}` });
        });
        return;
      }
      // Check if it's a numbered action item (short lines with action words)
      if (/^\d+\.\s/.test(line) && !this.isHeading(line)) {
        out.push({ type: 'action', text: line });
        return;
      }
      out.push({ type: 'normal', text: line });
    });
    return out;
  }

  static isHeading(line: string): boolean {
    const t = line.toLowerCase().trim();
    const h = ['summary','insights','actions','tags','conclusion','recommendations','overview','analysis','findings','key points','next steps','takeaways'];
    
    // Check for numbered section headings (like "1. The Core Polarity")
    const numberedSectionPattern = /^\d+\.\s+[A-Z][^.]*$/;
    if (numberedSectionPattern.test(line.trim()) && line.length < 100) {
      return true;
    }
    
    return line.length < 60 && h.some(s => t === s || t === `${s}:` || t.startsWith(`${s}:`));
  }

  static parseReport(content: string): ParsedBlock[] {
    const cleaned = this.cleanContent(content);
    const blocks = this.processBlocks(cleaned);
    
    return blocks;
  }
}
