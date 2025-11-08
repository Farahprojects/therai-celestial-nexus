import { EmailParser, ParsedEmailContent } from '../../utils/emailParser';

interface CleanEmailRendererProps {
  body: string;
}

export const CleanEmailRenderer = ({ body }: CleanEmailRendererProps) => {
  const parsedContent: ParsedEmailContent = EmailParser.parseEmailContent(body);
  const formattedMainContent = EmailParser.formatText(parsedContent.mainContent);

  return (
    <div className="max-w-none">
      {/* Main message content - keep inside prose for typography */}
      <div className="prose max-w-none">
        <div className="text-gray-800 leading-relaxed text-base mb-6">
          {formattedMainContent.split('\n').map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return <div key={index} className="h-4" />; // Spacer for empty lines

            return (
              <p key={index} className="mb-3 last:mb-0">
                {trimmed}
              </p>
            );
          })}
        </div>
      </div>

      {/* Quoted message section - outside prose to avoid conflicts */}
      {parsedContent.quotedMessage && (
        <div className="border-l-[3px] border-gray-300 pl-4 mt-8 text-sm text-gray-600 bg-gray-50/30 py-3 rounded-r-md">
          <div className="font-semibold text-gray-800 mb-3 text-left">
            --- Original Message ---
          </div>

          <div className="space-y-1 mb-4">
            <div className="text-sm">
              <span className="font-medium text-gray-900">From:</span>{' '}
              <span className="text-gray-600">{parsedContent.quotedMessage.from}</span>
            </div>
            {parsedContent.quotedMessage.date && (
              <div className="text-sm">
                <span className="font-medium text-gray-900">Date:</span>{' '}
                <span className="text-gray-600">{parsedContent.quotedMessage.date}</span>
              </div>
            )}
            {parsedContent.quotedMessage.subject && (
              <div className="text-sm">
                <span className="font-medium text-gray-900">Subject:</span>{' '}
                <span className="text-gray-600">{parsedContent.quotedMessage.subject}</span>
              </div>
            )}
          </div>

          <div className="text-gray-700 leading-relaxed text-sm">
            {parsedContent.quotedMessage.content.split('\n').map((line, index) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={index} className="h-2" />;

              return (
                <p key={index} className="mb-2 last:mb-0">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
