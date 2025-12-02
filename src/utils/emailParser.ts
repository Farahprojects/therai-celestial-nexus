
export interface ParsedEmailContent {
  mainContent: string;
  quotedMessage?: {
    from: string;
    date: string;
    subject: string;
    content: string;
  };
}

export class EmailParser {
  // Clean HTML tags and convert to plain text with proper formatting
  static cleanHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<\/div>/gi, '')
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple line breaks to double
      .trim();
  }

  // Parse email content to separate main message from quoted content
  static parseEmailContent(body: string): ParsedEmailContent {
    const cleanedBody = this.cleanHtml(body);
    
    // Look for common quoted message patterns
    const quotedPatterns = [
      /--- Original Message ---/i,
      /-----Original Message-----/i,
      /On .+ wrote:/i,
      /From: .+\nSent: .+\nTo: .+\nSubject: .+/i
    ];

    let quotedStartIndex = -1;

    for (const pattern of quotedPatterns) {
      const match = cleanedBody.match(pattern);
      if (match && match.index !== undefined) {
        quotedStartIndex = match.index;
        break;
      }
    }

    if (quotedStartIndex === -1) {
      return { mainContent: cleanedBody };
    }

    const mainContent = cleanedBody.substring(0, quotedStartIndex).trim();
    const quotedContent = cleanedBody.substring(quotedStartIndex).trim();

    // Try to parse quoted message details
    const quotedMessage = this.parseQuotedMessage(quotedContent);

    return {
      mainContent,
      quotedMessage
    };
  }

  // Parse quoted message to extract metadata
  private static parseQuotedMessage(quotedContent: string): ParsedEmailContent['quotedMessage'] {
    const lines = quotedContent.split('\n').filter(line => line.trim());
    
    let from = '';
    let date = '';
    let subject = '';
    let contentStartIndex = 0;

    // Look for From, Date, Subject patterns
    for (let i = 0; i < lines.length && i < 10; i++) {
      const line = lines[i].trim();
      
      if (line.toLowerCase().startsWith('from:')) {
        from = line.substring(5).trim();
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      } else if (line.toLowerCase().includes('sent:') || line.toLowerCase().includes('date:')) {
        date = line.replace(/^(sent:|date:)/i, '').trim();
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      } else if (line.toLowerCase().startsWith('subject:')) {
        subject = line.substring(8).trim();
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      } else if (line.toLowerCase().startsWith('to:')) {
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      }
    }

    const content = lines.slice(contentStartIndex).join('\n').trim();

    return {
      from: from || 'Unknown sender',
      date: date || 'Unknown date',
      subject: subject || 'No subject',
      content: content || quotedContent
    };
  }

  // Format text with proper capitalization and punctuation
  static formatText(text: string): string {
    return text
      .replace(/\bi\b/g, 'I') // Fix lowercase "i"
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`) // Capitalize after punctuation
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .trim();
  }
}
