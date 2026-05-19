// Carrega lazy a família detectada e aplica a fallback chain (§5.4):
// se a família lançar (decode falhou) ou o chunk falhar, desce para
// texto e por fim hex — que nunca lança. Nada termina em erro.

import {
  Component,
  Suspense,
  lazy,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Kind, Source } from "../viewers/types";
import { registry, fallbackChain } from "./registry";

class ErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ViewerHost({ source, kind }: { source: Source; kind: Kind }) {
  const chain = useMemo(() => fallbackChain(kind), [kind]);
  const [idx, setIdx] = useState(0);
  const current = chain[Math.min(idx, chain.length - 1)];
  const isLast = idx >= chain.length - 1;

  const Family = useMemo(() => lazy(registry[current]), [current]);

  return (
    <ErrorBoundary
      key={current}
      onError={() => {
        if (!isLast) setIdx((i) => i + 1);
      }}
    >
      <Suspense fallback={<div className="status">Carregando…</div>}>
        <Family source={source} />
      </Suspense>
    </ErrorBoundary>
  );
}
