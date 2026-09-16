import { createFileRoute } from "@tanstack/react-router";
import CatalogView from "@/components/porch/CatalogView";
import { PorchNav } from "@/components/porch/PorchNav";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Каталог оборудования SARO" },
      { name: "description", content: "Каталог SARO: греющие кабели, терморегуляторы, шкафы управления и монтажные аксессуары." },
      { property: "og:title", content: "Каталог оборудования SARO" },
      { property: "og:description", content: "Кабели, терморегуляторы, шкафы управления и аксессуары SARO для систем антиобледенения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <>
      <PorchNav title="Каталог продукции" />
      <CatalogView />
    </>
  );
}
