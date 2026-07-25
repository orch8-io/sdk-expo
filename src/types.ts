/** Configuration for the Orch8Client. */
export interface Orch8ClientConfig {
  baseUrl: string;
  tenantId?: string;
  namespace?: string;
  headers?: Record<string, string>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  retry?: RetryConfig | false;
  timeoutMs?: number;
  onRequest?: (event: RequestEvent) => void;
  onResponse?: (event: ResponseEvent) => void;
}

export interface RetryConfig {
  /** Total attempts, including the first request. Defaults to 3. */
  maxAttempts?: number;
  /** Initial exponential-backoff delay. Defaults to 250 milliseconds. */
  baseDelayMs?: number;
  /** Called before retrying; attempt is the one-based next attempt. */
  onRetry?: (error: unknown, attempt: number) => void;
}

export interface RequestEvent {
  method: string;
  path: string;
  attempt: number;
  maxAttempts: number;
}

export interface ResponseEvent extends RequestEvent {
  durationMs: number;
  status?: number;
  error?: unknown;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  total?: number;
}

export interface InstanceStreamOptions {
  pollMs?: number;
  lastEventId?: string;
  signal?: AbortSignal;
}

export interface ResumableInstanceSSEEvent {
  id?: string;
  event?: string;
  data: InstanceSSEEvent;
}

export interface SequenceDefinition {
  id: string;
  tenant_id: string;
  namespace: string;
  name: string;
  version: number;
  deprecated: boolean;
  blocks: Block[];
  interceptors?: unknown;
  input_schema?: unknown;
  sla?: { max_runtime?: number; max_step_runtime?: number };
  on_failure?: Block[];
  on_cancel?: Block[];
  status?: "draft" | "staging" | "production" | "unpublished";
  created_at: string;
}

export interface CreateSequenceResponse {
  id: string;
  warnings?: string[];
}

export interface Block {
  type: string;
  id: string;
  handler?: string;
  params?: Record<string, unknown>;
  cancellable?: boolean;
  wait_for_input?: WaitForInput;
  fallback_handler?: string;
  cache_key?: string;
  output_schema?: unknown;
  when?: string;
  compensation?: StepCompensation;
  retry?: RetryPolicy;
  delay?: DelaySpec;
  blocks?: Block[];
  body?: Block[];
  branches?: Block[][];
  steps?: SagaStep[];
  condition?: string;
  collection?: string;
  break_on?: string;
  continue_on_error?: boolean;
  poll_interval?: number;
  retain_iterations?: number;
}

export interface RetryPolicy {
  max_attempts?: number;
  initial_backoff?: number;
  max_backoff?: number;
  backoff_multiplier?: number;
  retry_if?: string;
  non_retryable_codes?: string[];
}

export interface DelaySpec {
  duration: number;
  business_days_only?: boolean;
  jitter?: number;
  holidays?: string[];
  fire_at_local?: string;
  timezone?: string;
}

export interface StepCompensation {
  handler: string;
  params?: unknown;
  depends_on?: string[];
  verification?: "handler_result" | "provider_receipt" | "manual";
}

export interface SagaStep {
  id: string;
  action: Block;
  compensation?: Block;
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
  resume_checkpoint?: unknown;
  checkpoint_seq: number;
  created_at: string;
}

export interface NativeContinuityImportResult {
  capsuleId: string;
  continuityId: string;
  instanceId: string;
  sourceEpoch: number;
  state: string;
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
  sequence_id: string;
  namespace?: string;
  tenant_id?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: number;
  timezone?: string;
  concurrency_key?: string;
  max_concurrency?: number;
  idempotency_key?: string;
  session_id?: string;
  parent_instance_id?: string;
  next_fire_at?: string;
  dry_run?: boolean;
  dry_run_auto_approve?: boolean;
};

export type CreateSequenceBody = {
  id?: string;
  name: string;
  tenant_id?: string;
  namespace?: string;
  version?: number;
  deprecated?: boolean;
  status?: "draft" | "staging" | "production" | "unpublished";
  blocks: Block[];
  interceptors?: unknown;
  input_schema?: unknown;
  sla?: { max_runtime?: number; max_step_runtime?: number };
  on_failure?: Block[];
  on_cancel?: Block[];
  created_at?: string;
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
  checkpoint?: unknown;
  checkpoint_seq?: number;
};

export interface HeartbeatResponse {
  checkpoint_seq: number;
}

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
  /** @deprecated Tenant identity is carried by loaded sequences in the current mobile engine. */
  tenantId?: string;
  /** @deprecated Namespace is carried by loaded sequences in the current mobile engine. */
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
  telemetryUrl?: string;
  environment?: "production" | "staging";
  rootPublicKey?: string;
  sequencesUrl?: string;
  syncUrl?: string;
  deviceId?: string;
  syncApiKey?: string;
}

export const NATIVE_ENGINE_DEFAULTS: Required<Omit<
  NativeEngineConfig,
  | "tenantId"
  | "namespace"
  | "rootPublicKey"
  | "sequencesUrl"
  | "telemetryUrl"
  | "environment"
  | "syncUrl"
  | "deviceId"
  | "syncApiKey"
>> = {
  tickIntervalMs: 100,
  maxConcurrentSteps: 4,
  maxConcurrentInstances: 10,
  maxStepsPerInstance: 1000,
  handlerTimeoutMs: 30_000,
  maxTickDurationMs: 5_000,
  operationTimeoutMs: 10_000,
  maxStoredSequences: 50,
  maxSequenceSizeBytes: 1_048_576,
  maxInstanceLifetimeSecs: 86_400,
  memoryBudgetBytes: 0,
  telemetryEnabled: true,
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

/** Aggregate result from a bounded OS-granted background execution window. */
export interface NativeBackgroundRunResult extends NativeTickResult {
  ticksExecuted: number;
  /** Work remains after the window ended or a tick made no progress. */
  budgetExhausted: boolean;
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
