// Client
export { Orch8Client, Orch8Error } from "./client.js";
export type { IOrch8Client } from "./client.js";
export { ORCH8_API_VERSION, ORCH8_ROUTES } from "./generated/routes.js";

// Native engine bridge
export { NativeEngine } from "./native.js";
export type { NativeEngineEvent } from "./native.js";

// Provider & context
export {
  Orch8Provider,
  useOrch8,
  useOrch8Client,
  useNativeEngine,
} from "./provider.js";
export type { Orch8ProviderProps, Orch8ContextValue } from "./provider.js";

// Hooks — remote (REST API)
export { useInstance } from "./hooks/useInstance.js";
export type { UseInstanceOptions, UseInstanceReturn } from "./hooks/useInstance.js";
export { useWorkflow } from "./hooks/useWorkflow.js";
export type { UseWorkflowReturn } from "./hooks/useWorkflow.js";
export { useStream } from "./hooks/useStream.js";
export type { UseStreamOptions, UseStreamReturn } from "./hooks/useStream.js";

// Hooks — native (on-device engine)
export { useNativeWorkflow } from "./hooks/useNativeWorkflow.js";
export type {
  UseNativeWorkflowOptions,
  UseNativeWorkflowReturn,
} from "./hooks/useNativeWorkflow.js";

// Types — response
export type {
  Orch8ClientConfig,
  RetryConfig,
  RequestEvent,
  ResponseEvent,
  Page,
  InstanceStreamOptions,
  ResumableInstanceSSEEvent,
  SequenceDefinition,
  CreateSequenceResponse,
  Block,
  DelaySpec,
  RetryPolicy,
  StepCompensation,
  SagaStep,
  WaitForInput,
  TaskInstance,
  TaskInstanceState,
  ExecutionContext,
  AuditEntry,
  ExecutionNode,
  ExecutionNodeState,
  StepOutput,
  Checkpoint,
  CronSchedule,
  TriggerDef,
  PluginDef,
  Session,
  SessionState,
  WorkerTask,
  WorkerTaskStats,
  ClusterNode,
  ClusterNodeState,
  CircuitBreaker,
  CircuitBreakerState,
  FireTriggerResponse,
  BulkResponse,
  BatchCreateResponse,
  HealthResponse,
  HeartbeatResponse,
  ResourcePool,
  PoolResource,
  PoolResourceState,
  Credential,
  InstanceSSEEvent,
} from "./types.js";

// Types — request bodies
export type {
  CreateInstanceBody,
  CreateSequenceBody,
  MigrateInstanceBody,
  UpdateInstanceStateBody,
  UpdateInstanceContextBody,
  SendSignalBody,
  InjectBlocksBody,
  SaveCheckpointBody,
  PruneCheckpointsBody,
  BulkUpdateStateBody,
  BulkRescheduleBody,
  CreateCronBody,
  UpdateCronBody,
  CreateTriggerBody,
  FireTriggerBody,
  CreatePluginBody,
  UpdatePluginBody,
  CreateSessionBody,
  UpdateSessionDataBody,
  UpdateSessionStateBody,
  PollTasksBody,
  CompleteTaskBody,
  FailTaskBody,
  HeartbeatTaskBody,
  CreatePoolBody,
  CreatePoolResourceBody,
  UpdatePoolResourceBody,
  CreateCredentialBody,
  UpdateCredentialBody,
} from "./types.js";

// Native engine defaults & bridging
export { NATIVE_ENGINE_DEFAULTS, taskInstanceToBase, nativeInstanceToBase } from "./types.js";

// Types — native engine
export type {
  InstanceStateKind,
  PowerState,
  NativeEngineConfig,
  NativeInstanceSummary,
  NativeInstanceState,
  NativeTickResult,
  NativeBackgroundRunResult,
  NativeSequenceInfo,
  NativeSyncResult,
  NativeContinuityImportResult,
  InstanceBase,
} from "./types.js";
