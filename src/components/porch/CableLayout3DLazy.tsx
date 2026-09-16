import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const CableLayout3D = lazy(() => import("./CableLayout3D"));

type Props = {
  stepLength: number;
  stepWidth: number;
  stepCount: number;
  platformLength: number;
  platformWidth: number;
  cableStep: number;
  threadsPerStep: number;
};

const Fallback = () => (
  <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
    Загрузка 3D-модели…
  </div>
);

export default function CableLayout3DLazy(props: Props) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <CableLayout3D {...props} />
      </Suspense>
    </ClientOnly>
  );
}
