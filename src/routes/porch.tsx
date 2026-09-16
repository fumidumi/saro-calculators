import { createFileRoute } from "@tanstack/react-router";
import PorchCalculator from "@/components/porch/PorchCalculator";
import { PorchNav } from "@/components/porch/PorchNav";

export const Route = createFileRoute("/porch")({
  head: () => ({
    meta: [
      { title: "Калькулятор обогрева крыльца и ступеней SARO" },
      { name: "description", content: "Расчет обогрева крыльца и ступеней SARO: шаг укладки, длина секции, мощность, 3D-раскладка кабеля и спецификация." },
      { property: "og:title", content: "Калькулятор обогрева крыльца и ступеней SARO" },
      { property: "og:description", content: "Подбор греющего кабеля SARO для ступеней и площадки с визуализацией раскладки и коммерческим предложением." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PorchPage,
});

function PorchPage() {
  return (
    <>
      <PorchNav title="Крыльцо и ступени" />
      <PorchCalculator />
    </>
  );
}
