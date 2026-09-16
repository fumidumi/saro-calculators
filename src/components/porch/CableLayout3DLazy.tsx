import { Component, lazy, Suspense, type ReactNode } from "react";
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

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          3D-модель недоступна для текущих параметров. Расчёт и 2D-схема работают как обычно.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CableLayout3DLazy(props: Props) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Boundary>
        <Suspense fallback={<Fallback />}>
          <CableLayout3D {...props} />
        </Suspense>
      </Boundary>
    </ClientOnly>
  );
}
