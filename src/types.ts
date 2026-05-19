/** Configuration for the Orch8Client. */
export interface Orch8ClientConfig {
  baseUrl: string;
  tenantId?: string;
  namespace?: string;
  headers?: Record<string, string>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  retry?: RetryConfig | false;
  timeoutMs?: number;
}

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

export interface SequenceDefinition {
  id: string;
  tenant_id: string;
  namespace: string;
  name: string;
  version: number;
  deprecated: boolean;
  blocks: Block[];
  interceptors?: Block[];
  created_at: string;
}

export interface Block {
  type: string;
  id: string;
  handler?: string;
  params?: Record<string, unknown>;
  cancellable?: boolean;
  wait_for_input?: WaitForInput;
}

export interface WaitForInput {
  prompt?: string;
  choices?: Array<{ label: string; value: string }>;
}

export type TaskInstanceState =
  | "scheduled"
  | "running"
  | "waiting"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionNodeState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type SessionState = "active" | "closed" | "expired";

export type CircuitBreakerState = "closed" | "open" | "half_open";

export type ClusterNodeState = "active" | "draining" | "inactive";

export type PoolResourceState = "available" | "locked" | "disabled";

export interface TaskInstance {
  id: string;
  sequence_id: string;
  tenant_id: string;
  namespace: string;
  state: TaskInstanceState;
  next_fire_at: string | null;
  priority: number;
  timezone: string;
  metadata: Record<string, unknown>;
  context: ExecutionContext;
  concurrency_key: string | null;
  max_concurrency: number | null;
  idempotency_key: string | null;
  session_id: string | null;
  parent_instance_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionContext {
  data: Record<string, unknown>;
  config: Record<string, unknown>;
  audit: AuditEntry[];
  runtime: Record<string, unknown>;
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  details: unknown;
}

export interface ExecutionNode {
  id: string;
  instance_id: string;
  block_id: string;
  parent_id: string | null;
  block_type: string;
  branch_index: number | null;
  state: ExecutionNodeState;
  started_at: string | null;
  completed_at: string | null;
}

export interface StepOutput {
  id: string;
  instance_id: string;
  block_id: string;
  output: unknown;
  output_ref: string | null;
  output_size: number;
  attempt: number;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  instance_id: string;
  checkpoint_data: unknown;
  created_at: string;
}

export interface CronSchedule {
  id: string;
  tenant_id: string;
  namespace: string;
  sequence_id: string;
  version: number | null;
  cron_expr: string;
  timezone: string;
  enabled: boolean;
  metadata: unknown;
  last_triggered_at: string | null;
  next_fire_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerDef {
  slug: string;
  sequence_name: string;
  version: number | null;
  tenant_id: string;
  namespace: string;
  enabled: boolean;
  secret: string | null;
  trigger_type: string;
  config: unknown;
  created_at: string;
  updated_at: string;
}

export interface PluginDef {
  name: string;
  plugin_type: string;
  source: string;
  tenant_id: string;
  enabled: boolean;
  config: unknown;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  tenant_id: string;
  session_key: string;
  state: SessionState;
  data: unknown;
  created_at: string;
  updated_at: string;
}

export interface WorkerTask {
  id: string;
  instance_id: string;
  block_id: string;
  handler_name: string;
  params: unknown;
  context: unknown;
  attempt: number;
  timeout_ms: number | null;
  state: "pending" | "claimed" | "completed" | "failed";
  worker_id: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  output: unknown;
  error_message: string | null;
  error_retryable: boolean | null;
  created_at: string;
}

export interface ClusterNode {
  id: string;
  address: string;
  state: ClusterNodeState;
  last_heartbeat: string;
}

export interface WorkerTaskStats {
  pending: number;
  claimed: number;
  completed: number;
  failed: number;
}

export interface CircuitBreaker {
  handler: string;
  state: CircuitBreakerState;
  failure_count: number;
  last_failure: string | null;
}

export interface FireTriggerResponse {
  instance_id: string;
  trigger: string;
  sequence_name: string;
}

export interface BulkResponse {
  updated: number;
}

export interface BatchCreateResponse {
  created: number;
}

export interface HealthResponse {
  status: string;
}

export interface ResourcePool {
  id: string;
  tenant_id: string;
  name: string;
  max_size: number;
  current_size: number;
  config: unknown;
  created_at: string;
  updated_at: string;
}

export interface PoolResource {
  id: string;
  pool_id: string;
  resource_key: string;
  state: PoolResourceState;
  data: unknown;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Credential {
  id: string;
  tenant_id: string;
  name: string;
  credential_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

export type CreateInstanceBody = {
  sequence_name: string;
  namespace?: string;
  tenant_id?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: number;
  timezone?: string;
  concurrency_key?: string;
  max_concurrency?: number;
  idempotency_key?: string;
  session_id?: string;
  scheduled_at?: string;
};

export type CreateSequenceBody = {
  name: string;
  tenant_id?: string;
  namespace?: string;
  blocks: Block[];
  interceptors?: Block[];
};

export type MigrateInstanceBody = {
  instance_id: string;
  target_sequence_id: string;
};

export type UpdateInstanceStateBody = {
  state: string;
  reason?: string;
};

export type UpdateInstanceContextBody = {
  data?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export type SendSignalBody = {
  name: string;
  payload?: Record<string, unknown>;
};

export type InjectBlocksBody = {
  blocks: Block[];
};

export type SaveCheckpointBody = {
  checkpoint_data: unknown;
};

export type PruneCheckpointsBody = {
  keep_count?: number;
};

export type BulkUpdateStateBody = {
  filter: Record<string, string>;
  state: string;
  reason?: string;
};

export type BulkRescheduleBody = {
  filter: Record<string, string>;
  scheduled_at: string;
};

export type CreateCronBody = {
  sequence_id: string;
  cron_expr: string;
  tenant_id?: string;
  namespace?: string;
  timezone?: string;
  enabled?: boolean;
  metadata?: unknown;
};

export type UpdateCronBody = {
  cron_expr?: string;
  timezone?: string;
  enabled?: boolean;
  metadata?: unknown;
};

export type CreateTriggerBody = {
  slug: string;
  sequence_name: string;
  tenant_id?: string;
  namespace?: string;
  version?: number;
  enabled?: boolean;
  secret?: string;
  trigger_type: string;
  config?: unknown;
};

export type FireTriggerBody = {
  payload?: Record<string, unknown>;
};

export type CreatePluginBody = {
  name: string;
  plugin_type: string;
  source: string;
  tenant_id?: string;
  enabled?: boolean;
  config?: unknown;
  description?: string;
};

export type UpdatePluginBody = {
  source?: string;
  enabled?: boolean;
  config?: unknown;
  description?: string;
};

export type CreateSessionBody = {
  session_key: string;
  tenant_id?: string;
  data?: unknown;
};

export type UpdateSessionDataBody = {
  data: unknown;
};

export type UpdateSessionStateBody = {
  state: string;
};

export type PollTasksBody = {
  worker_id: string;
  handler_names?: string[];
  max_tasks?: number;
};

export type CompleteTaskBody = {
  output?: unknown;
};

export type FailTaskBody = {
  error_message: string;
  retryable?: boolean;
};

export type HeartbeatTaskBody = {
  progress?: Record<string, unknown>;
};

export type CreatePoolBody = {
  name: string;
  tenant_id?: string;
  max_size: number;
  config?: unknown;
};

export type CreatePoolResourceBody = {
  resource_key: string;
  data?: unknown;
};

export type UpdatePoolResourceBody = {
  data?: unknown;
  state?: string;
};

export type CreateCredentialBody = {
  name: string;
  credential_type: string;
  tenant_id?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateCredentialBody = {
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

export type InstanceSSEEvent =
  | { type: "step_started"; block_id: string; handler: string }
  | { type: "step_completed"; block_id: string; output: unknown }
  | { type: "step_failed"; block_id: string; error: string }
  | { type: "step_pending"; block_id: string; prompt?: string }
  | { type: "instance_completed"; output: unknown }
  | { type: "instance_failed"; error: string }
  | { type: "instance_cancelled" }
  | { type: "state_changed"; from: string; to: string };

// ---------------------------------------------------------------------------
// Native engine types (mirror orch8-mobile UniFFI records)
// ---------------------------------------------------------------------------

export type InstanceStateKind =
  | "scheduled"
  | "running"
  | "waiting"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PowerState = "charging" | "unplugged" | "lowBattery" | "criticalBattery";

export interface NativeEngineConfig {
  tenantId?: string;
  namespace?: string;
  tickIntervalMs?: number;
  maxConcurrentSteps?: number;
  maxConcurrentInstances?: number;
  maxStepsPerInstance?: number;
  handlerTimeoutMs?: number;
  maxTickDurationMs?: number;
  operationTimeoutMs?: number;
  maxStoredSequences?: number;
  maxSequenceSizeBytes?: number;
  maxInstanceLifetimeSecs?: number;
  memoryBudgetBytes?: number;
  telemetryEnabled?: boolean;
  environment?: string;
  rootPublicKey?: string;
  sequencesUrl?: string;
}

export const NATIVE_ENGINE_DEFAULTS: Required<Omit<NativeEngineConfig, "rootPublicKey" | "sequencesUrl" | "environment">> = {
  tenantId: "mobile",
  namespace: "default",
  tickIntervalMs: 200,
  maxConcurrentSteps: 4,
  maxConcurrentInstances: 50,
  maxStepsPerInstance: 1000,
  handlerTimeoutMs: 30_000,
  maxTickDurationMs: 5_000,
  operationTimeoutMs: 10_000,
  maxStoredSequences: 100,
  maxSequenceSizeBytes: 1_048_576,
  maxInstanceLifetimeSecs: 86_400,
  memoryBudgetBytes: 0,
  telemetryEnabled: false,
};

export interface NativeInstanceSummary {
  instanceId: string;
  sequenceName: string;
  state: InstanceStateKind;
  createdAt: string;
}

export interface NativeInstanceState {
  instanceId: string;
  sequenceName: string;
  state: InstanceStateKind;
  context: string;
  createdAt: string;
  updatedAt: string;
}

export interface NativeTickResult {
  instancesAdvanced: number;
  stepsExecuted: number;
  hasPendingWork: boolean;
}

export interface NativeSequenceInfo {
  name: string;
  version: number;
}

export interface NativeSyncResult {
  sequencesUpdated: number;
  sequencesRemoved: number;
}

// ---------------------------------------------------------------------------
// Common instance type bridging native and remote layers
// ---------------------------------------------------------------------------

export interface InstanceBase {
  id: string;
  sequenceName: string;
  state: InstanceStateKind;
  createdAt: string;
  updatedAt: string;
}

export function taskInstanceToBase(ti: TaskInstance): InstanceBase {
  return {
    id: ti.id,
    sequenceName: ti.sequence_id,
    state: ti.state,
    createdAt: ti.created_at,
    updatedAt: ti.updated_at,
  };
}

export function nativeInstanceToBase(ni: NativeInstanceState): InstanceBase {
  return {
    id: ni.instanceId,
    sequenceName: ni.sequenceName,
    state: ni.state,
    createdAt: ni.createdAt,
    updatedAt: ni.updatedAt,
  };
}
