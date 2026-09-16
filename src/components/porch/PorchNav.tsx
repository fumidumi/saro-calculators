import { Link } from "@tanstack/react-router";
import { ChevronLeft, Calculator, BookOpen, Info } from "lucide-react";

export function PorchNav({ title }: { title: string }) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Все калькуляторы
          </Link>
          <span className="hidden text-sm font-semibold sm:inline">{title}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/porch" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            <Calculator className="h-4 w-4" /> Расчет
          </Link>
          <Link to="/catalog" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            <BookOpen className="h-4 w-4" /> Каталог
          </Link>
          <Link to="/about" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            <Info className="h-4 w-4" /> О системе
          </Link>
        </nav>
      </div>
    </header>
  );
}
