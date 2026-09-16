import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import {
  buildQuoteBodyHTML,
  printQuote,
  downloadQuotePDF,
  QUOTE_STYLES,
  type QuoteData,
} from "@/lib/porch/generateQuote";

interface QuotePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteData | null;
}

const QuotePreviewDialog = ({ open, onOpenChange, quote }: QuotePreviewDialogProps) => {
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!quote) return null;

  const handleDownload = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    setPdfError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadQuotePDF(docRef.current, `KP-SARO-${date}.pdf`);
    } catch (e) {
      console.error("Ошибка генерации PDF:", e);
      setPdfError("Не удалось сформировать PDF. Попробуйте печать.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    printQuote(quote);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Предпросмотр коммерческого предложения</DialogTitle>
          <DialogDescription>
            Проверьте содержимое и скачайте PDF или отправьте на печать.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <style>{QUOTE_STYLES}</style>
          <div
            ref={docRef}
            className="quote-doc mx-auto shadow-sm"
            style={{ maxWidth: "210mm" }}
            dangerouslySetInnerHTML={{ __html: buildQuoteBodyHTML(quote) }}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 border-t bg-background">
          {pdfError && (
            <p className="text-sm text-destructive sm:mr-auto">{pdfError}</p>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Печать
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Скачать PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuotePreviewDialog;
