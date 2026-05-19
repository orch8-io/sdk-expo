import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { Orch8Client } from "./client.js";
import { NativeEngine } from "./native.js";
import type { Orch8ClientConfig, NativeEngineConfig } from "./types.js";

export interface Orch8ContextValue {
  client: Orch8Client | null;
  engine: NativeEngine | null;
}

const Orch8Context = createContext<Orch8ContextValue>({
  client: null,
  engine: null,
});

export interface Orch8ProviderProps {
  children: React.ReactNode;
  clientConfig?: Orch8ClientConfig;
  nativeConfig?: NativeEngineConfig & { dbPath: string };
}

export function Orch8Provider({
  children,
  clientConfig,
  nativeConfig,
}: Orch8ProviderProps) {
  const [engine, setEngine] = useState<NativeEngine | null>(null);

  const clientConfigKey = clientConfig
    ? `${clientConfig.baseUrl}|${clientConfig.tenantId ?? ""}|${clientConfig.namespace ?? ""}|${JSON.stringify(clientConfig.headers ?? {})}|${JSON.stringify(clientConfig.retry ?? "")}`
    : null;

  const client = useMemo(
    () => (clientConfig ? new Orch8Client(clientConfig) : null),
    [clientConfigKey],
  );

  const nativeConfigKey = nativeConfig ? JSON.stringify(nativeConfig) : null;

  useEffect(() => {
    if (!nativeConfig) {
      setEngine(null);
      return;
    }
    const eng = new NativeEngine();
    eng.create(nativeConfig.dbPath, nativeConfig);
    setEngine(eng);
    return () => {
      eng.pause();
      eng.destroy();
      setEngine(null);
    };
  }, [nativeConfigKey]);

  const value = useMemo<Orch8ContextValue>(
    () => ({ client, engine }),
    [client, engine],
  );

  return (
    <Orch8Context.Provider value={value}>{children}</Orch8Context.Provider>
  );
}

export function useOrch8(): Orch8ContextValue {
  return useContext(Orch8Context);
}

export function useOrch8Client(): Orch8Client {
  const { client } = useOrch8();
  if (!client) {
    throw new Error("useOrch8Client requires Orch8Provider with clientConfig");
  }
  return client;
}

export function useNativeEngine(): NativeEngine {
  const { engine } = useOrch8();
  if (!engine) {
    throw new Error("useNativeEngine requires Orch8Provider with nativeConfig");
  }
  return engine;
}
