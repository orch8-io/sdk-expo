import type {
  Orch8ClientConfig,
  RetryConfig,
  SequenceDefinition,
  TaskInstance,
  StepOutput,
  ExecutionNode,
  Checkpoint,
  CronSchedule,
  TriggerDef,
  PluginDef,
  Session,
  WorkerTask,
  WorkerTaskStats,
  ClusterNode,
  CircuitBreaker,
  FireTriggerResponse,
  BulkResponse,
  BatchCreateResponse,
  HealthResponse,
  ResourcePool,
  PoolResource,
  Credential,
  AuditEntry,
  InstanceSSEEvent,
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

export class Orch8Error extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly path: string,
  ) {
    const excerpt = typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body)?.slice(0, 200) ?? "";
    super(`Orch8 API error ${status} on ${path}: ${excerpt}`);
    this.name = "Orch8Error";
  }
}

export interface IOrch8Client {
  // Sequences
  createSequence(body: CreateSequenceBody): Promise<SequenceDefinition>;
  getSequence(id: string): Promise<SequenceDefinition>;
  getSequenceByName(tenantId: string, namespace: string, name: string, version?: number): Promise<SequenceDefinition>;
  deprecateSequence(id: string): Promise<void>;
  listSequenceVersions(tenantId: string, namespace: string, name: string): Promise<SequenceDefinition[]>;
  listSequences(filter?: Record<string, string>): Promise<SequenceDefinition[]>;
  deleteSequence(id: string): Promise<void>;
  migrateInstance(body: MigrateInstanceBody): Promise<TaskInstance>;
  // Instances
  createInstance(body: CreateInstanceBody): Promise<TaskInstance>;
  batchCreateInstances(instances: CreateInstanceBody[]): Promise<BatchCreateResponse>;
  getInstance(id: string): Promise<TaskInstance>;
  listInstances(filter?: Record<string, string>): Promise<TaskInstance[]>;
  updateInstanceState(id: string, body: UpdateInstanceStateBody): Promise<void>;
  updateInstanceContext(id: string, body: UpdateInstanceContextBody): Promise<void>;
  sendSignal(id: string, body: SendSignalBody): Promise<{ signal_id: string }>;
  getOutputs(id: string): Promise<StepOutput[]>;
  getExecutionTree(id: string): Promise<ExecutionNode[]>;
  retryInstance(id: string): Promise<TaskInstance>;
  listCheckpoints(id: string): Promise<Checkpoint[]>;
  saveCheckpoint(id: string, body: SaveCheckpointBody): Promise<Checkpoint>;
  getLatestCheckpoint(id: string): Promise<Checkpoint>;
  pruneCheckpoints(id: string, body?: PruneCheckpointsBody): Promise<void>;
  listAuditLog(id: string): Promise<AuditEntry[]>;
  injectBlocks(id: string, body: InjectBlocksBody): Promise<void>;
  streamInstance(id: string, signal?: AbortSignal): AsyncGenerator<InstanceSSEEvent>;
  bulkUpdateState(body: BulkUpdateStateBody): Promise<BulkResponse>;
  bulkReschedule(body: BulkRescheduleBody): Promise<BulkResponse>;
  listDLQ(filter?: Record<string, string>): Promise<TaskInstance[]>;
  // Approvals
  listApprovals(filter?: Record<string, string>): Promise<TaskInstance[]>;
  // Cron
  createCron(body: CreateCronBody): Promise<CronSchedule>;
  listCron(tenantId?: string): Promise<CronSchedule[]>;
  getCron(id: string): Promise<CronSchedule>;
  updateCron(id: string, body: UpdateCronBody): Promise<CronSchedule>;
  deleteCron(id: string): Promise<void>;
  // Triggers
  createTrigger(body: CreateTriggerBody): Promise<TriggerDef>;
  listTriggers(tenantId?: string): Promise<TriggerDef[]>;
  getTrigger(slug: string): Promise<TriggerDef>;
  deleteTrigger(slug: string): Promise<void>;
  fireTrigger(slug: string, body?: FireTriggerBody): Promise<FireTriggerResponse>;
  // Plugins
  createPlugin(body: CreatePluginBody): Promise<PluginDef>;
  listPlugins(tenantId?: string): Promise<PluginDef[]>;
  getPlugin(name: string): Promise<PluginDef>;
  updatePlugin(name: string, body: UpdatePluginBody): Promise<PluginDef>;
  deletePlugin(name: string): Promise<void>;
  // Sessions
  createSession(body: CreateSessionBody): Promise<Session>;
  getSession(id: string): Promise<Session>;
  getSessionByKey(tenantId: string, key: string): Promise<Session>;
  updateSessionData(id: string, body: UpdateSessionDataBody): Promise<Session>;
  updateSessionState(id: string, body: UpdateSessionStateBody): Promise<Session>;
  listSessionInstances(id: string): Promise<TaskInstance[]>;
  // Workers
  pollTasks(body: PollTasksBody): Promise<WorkerTask[]>;
  completeTask(id: string, body: CompleteTaskBody): Promise<void>;
  failTask(id: string, body: FailTaskBody): Promise<void>;
  heartbeatTask(id: string, body: HeartbeatTaskBody): Promise<void>;
  listWorkerTasks(filter?: Record<string, string>): Promise<WorkerTask[]>;
  getWorkerTaskStats(): Promise<WorkerTaskStats>;
  // Circuit Breakers
  listCircuitBreakers(): Promise<CircuitBreaker[]>;
  getCircuitBreaker(handler: string): Promise<CircuitBreaker>;
  resetCircuitBreaker(handler: string): Promise<void>;
  listTenantCircuitBreakers(tenantId: string): Promise<CircuitBreaker[]>;
  getTenantCircuitBreaker(tenantId: string, handler: string): Promise<CircuitBreaker>;
  resetTenantCircuitBreaker(tenantId: string, handler: string): Promise<void>;
  // Resource Pools
  listPools(tenantId?: string): Promise<ResourcePool[]>;
  createPool(body: CreatePoolBody): Promise<ResourcePool>;
  getPool(id: string): Promise<ResourcePool>;
  deletePool(id: string): Promise<void>;
  listPoolResources(poolId: string): Promise<PoolResource[]>;
  createPoolResource(poolId: string, body: CreatePoolResourceBody): Promise<PoolResource>;
  updatePoolResource(poolId: string, resourceId: string, body: UpdatePoolResourceBody): Promise<PoolResource>;
  deletePoolResource(poolId: string, resourceId: string): Promise<void>;
  // Credentials
  listCredentials(tenantId?: string): Promise<Credential[]>;
  createCredential(body: CreateCredentialBody): Promise<Credential>;
  getCredential(id: string): Promise<Credential>;
  deleteCredential(id: string): Promise<void>;
  updateCredential(id: string, body: UpdateCredentialBody): Promise<Credential>;
  // Health
  health(): Promise<HealthResponse>;
}

const DEFAULT_RETRY: RetryConfig = { maxAttempts: 3, baseDelayMs: 1000 };

export class Orch8Client implements IOrch8Client {
  private readonly baseUrl: string;
  private readonly tenantId?: string;
  private readonly namespace?: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly retryConfig: RetryConfig | false;
  private readonly timeoutMs: number;
  private readonly getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;

  constructor(config: Orch8ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.tenantId = config.tenantId;
    this.namespace = config.namespace;
    this.extraHeaders = config.headers ?? {};
    this.getHeaders = config.getHeaders;
    this.retryConfig = config.retry === false ? false : { ...DEFAULT_RETRY, ...config.retry };
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private async buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const dynamic = this.getHeaders ? await this.getHeaders() : {};
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.extraHeaders,
      ...dynamic,
      ...extra,
    };
    if (this.tenantId) {
      headers["X-Tenant-Id"] = this.tenantId;
    }
    if (this.namespace) {
      headers["X-Namespace"] = this.namespace;
    }
    return headers;
  }

  private e(segment: string): string {
    return encodeURIComponent(segment);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const isIdempotent = method === "GET" || method === "HEAD";
    const maxAttempts =
      this.retryConfig && isIdempotent
        ? (this.retryConfig.maxAttempts ?? 3)
        : 1;
    const baseDelay =
      this.retryConfig ? (this.retryConfig.baseDelayMs ?? 1000) : 1000;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const headers = await this.buildHeaders();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        let res: Response;
        try {
          res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          if (res.status >= 500 && attempt < maxAttempts - 1) {
            if (this.retryConfig && this.retryConfig.onRetry) {
              this.retryConfig.onRetry(new Orch8Error(res.status, null, path), attempt);
            }
            await this.delay(baseDelay * Math.pow(2, attempt));
            continue;
          }
          let resBody: unknown;
          try {
            resBody = await res.json();
          } catch {
            resBody = await res.text().catch(() => null);
          }
          throw new Orch8Error(res.status, resBody, path);
        }

        if (res.status === 204) {
          return undefined as unknown as T;
        }

        const text = await res.text();
        if (!text) {
          return undefined as unknown as T;
        }
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null) {
          throw new Orch8Error(res.status, parsed, path);
        }
        return parsed as T;
      } catch (err) {
        lastError = err;
        if (err instanceof Orch8Error) throw err;
        if (attempt < maxAttempts - 1) {
          if (this.retryConfig && this.retryConfig.onRetry) {
            this.retryConfig.onRetry(err, attempt);
          }
          await this.delay(baseDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }
    throw lastError;
  }

  private async requestVoid(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<void> {
    await this.request<unknown>(method, path, body);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private del(path: string): Promise<void> {
    return this.requestVoid("DELETE", path);
  }

  // -- Sequences --

  createSequence(body: CreateSequenceBody): Promise<SequenceDefinition> {
    return this.post<SequenceDefinition>("/sequences", body);
  }

  getSequence(id: string): Promise<SequenceDefinition> {
    return this.get<SequenceDefinition>(`/sequences/${this.e(id)}`);
  }

  getSequenceByName(
    tenantId: string,
    namespace: string,
    name: string,
    version?: number,
  ): Promise<SequenceDefinition> {
    const params = new URLSearchParams({ tenant_id: tenantId, namespace, name });
    if (version !== undefined) params.set("version", String(version));
    return this.get<SequenceDefinition>(`/sequences/by-name?${params}`);
  }

  deprecateSequence(id: string): Promise<void> {
    return this.requestVoid("POST", `/sequences/${this.e(id)}/deprecate`);
  }

  listSequenceVersions(
    tenantId: string,
    namespace: string,
    name: string,
  ): Promise<SequenceDefinition[]> {
    const params = new URLSearchParams({ tenant_id: tenantId, namespace, name });
    return this.get<SequenceDefinition[]>(`/sequences/versions?${params}`);
  }

  listSequences(filter?: Record<string, string>): Promise<SequenceDefinition[]> {
    const params = filter ? `?${new URLSearchParams(filter)}` : "";
    return this.get<SequenceDefinition[]>(`/sequences${params}`);
  }

  deleteSequence(id: string): Promise<void> {
    return this.del(`/sequences/${this.e(id)}`);
  }

  migrateInstance(body: MigrateInstanceBody): Promise<TaskInstance> {
    return this.post<TaskInstance>("/sequences/migrate-instance", body);
  }

  // -- Instances --

  createInstance(body: CreateInstanceBody): Promise<TaskInstance> {
    return this.post<TaskInstance>("/instances", body);
  }

  batchCreateInstances(
    instances: CreateInstanceBody[],
  ): Promise<BatchCreateResponse> {
    return this.post<BatchCreateResponse>("/instances/batch", { instances });
  }

  getInstance(id: string): Promise<TaskInstance> {
    return this.get<TaskInstance>(`/instances/${this.e(id)}`);
  }

  listInstances(filter?: Record<string, string>): Promise<TaskInstance[]> {
    const params = filter ? `?${new URLSearchParams(filter)}` : "";
    return this.get<TaskInstance[]>(`/instances${params}`);
  }

  updateInstanceState(
    id: string,
    body: UpdateInstanceStateBody,
  ): Promise<void> {
    return this.requestVoid("PATCH", `/instances/${this.e(id)}/state`, body);
  }

  updateInstanceContext(
    id: string,
    body: UpdateInstanceContextBody,
  ): Promise<void> {
    return this.requestVoid("PATCH", `/instances/${this.e(id)}/context`, body);
  }

  sendSignal(
    id: string,
    body: SendSignalBody,
  ): Promise<{ signal_id: string }> {
    return this.post<{ signal_id: string }>(`/instances/${this.e(id)}/signals`, body);
  }

  getOutputs(id: string): Promise<StepOutput[]> {
    return this.get<StepOutput[]>(`/instances/${this.e(id)}/outputs`);
  }

  getExecutionTree(id: string): Promise<ExecutionNode[]> {
    return this.get<ExecutionNode[]>(`/instances/${this.e(id)}/tree`);
  }

  retryInstance(id: string): Promise<TaskInstance> {
    return this.post<TaskInstance>(`/instances/${this.e(id)}/retry`);
  }

  listCheckpoints(id: string): Promise<Checkpoint[]> {
    return this.get<Checkpoint[]>(`/instances/${this.e(id)}/checkpoints`);
  }

  saveCheckpoint(
    id: string,
    body: SaveCheckpointBody,
  ): Promise<Checkpoint> {
    return this.post<Checkpoint>(`/instances/${this.e(id)}/checkpoints`, body);
  }

  getLatestCheckpoint(id: string): Promise<Checkpoint> {
    return this.get<Checkpoint>(`/instances/${this.e(id)}/checkpoints/latest`);
  }

  pruneCheckpoints(
    id: string,
    body?: PruneCheckpointsBody,
  ): Promise<void> {
    return this.requestVoid("POST", `/instances/${this.e(id)}/checkpoints/prune`, body);
  }

  listAuditLog(id: string): Promise<AuditEntry[]> {
    return this.get<AuditEntry[]>(`/instances/${this.e(id)}/audit`);
  }

  injectBlocks(id: string, body: InjectBlocksBody): Promise<void> {
    return this.requestVoid("POST", `/instances/${this.e(id)}/inject-blocks`, body);
  }

  async *streamInstance(
    id: string,
    signal?: AbortSignal,
  ): AsyncGenerator<InstanceSSEEvent> {
    const headers = await this.buildHeaders({ Accept: "text/event-stream" });
    const res = await fetch(`${this.baseUrl}/instances/${this.e(id)}/stream`, {
      method: "GET",
      headers,
      signal,
    });

    if (!res.ok) {
      let resBody: unknown;
      try {
        resBody = await res.json();
      } catch {
        resBody = await res.text().catch(() => null);
      }
      throw new Orch8Error(res.status, resBody, `/instances/${this.e(id)}/stream`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";
    let eventData: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            eventData.push(line.slice(5).trimStart());
          } else if (line.trim() === "" && eventData.length > 0) {
            const data = eventData.join("\n");
            eventData = [];
            if (data && data !== "[DONE]") {
              try {
                yield JSON.parse(data) as InstanceSSEEvent;
              } catch {
                // skip non-JSON
              }
            }
          }
        }
      }
      if (eventData.length > 0) {
        const data = eventData.join("\n");
        if (data && data !== "[DONE]") {
          try {
            yield JSON.parse(data) as InstanceSSEEvent;
          } catch {
            // skip non-JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  bulkUpdateState(body: BulkUpdateStateBody): Promise<BulkResponse> {
    return this.patch<BulkResponse>("/instances/bulk/state", body);
  }

  bulkReschedule(body: BulkRescheduleBody): Promise<BulkResponse> {
    return this.patch<BulkResponse>("/instances/bulk/reschedule", body);
  }

  listDLQ(filter?: Record<string, string>): Promise<TaskInstance[]> {
    const params = filter ? `?${new URLSearchParams(filter)}` : "";
    return this.get<TaskInstance[]>(`/instances/dlq${params}`);
  }

  // -- Approvals --

  listApprovals(filter?: Record<string, string>): Promise<TaskInstance[]> {
    const params = filter ? `?${new URLSearchParams(filter)}` : "";
    return this.get<TaskInstance[]>(`/approvals${params}`);
  }

  // -- Cron --

  createCron(body: CreateCronBody): Promise<CronSchedule> {
    return this.post<CronSchedule>("/cron", body);
  }

  listCron(tenantId?: string): Promise<CronSchedule[]> {
    const params = tenantId
      ? `?${new URLSearchParams({ tenant_id: tenantId })}`
      : "";
    return this.get<CronSchedule[]>(`/cron${params}`);
  }

  getCron(id: string): Promise<CronSchedule> {
    return this.get<CronSchedule>(`/cron/${this.e(id)}`);
  }

  updateCron(
    id: string,
    body: UpdateCronBody,
  ): Promise<CronSchedule> {
    return this.put<CronSchedule>(`/cron/${this.e(id)}`, body);
  }

  deleteCron(id: string): Promise<void> {
    return this.del(`/cron/${this.e(id)}`);
  }

  // -- Triggers --

  createTrigger(body: CreateTriggerBody): Promise<TriggerDef> {
    return this.post<TriggerDef>("/triggers", body);
  }

  listTriggers(tenantId?: string): Promise<TriggerDef[]> {
    const params = tenantId
      ? `?${new URLSearchParams({ tenant_id: tenantId })}`
      : "";
    return this.get<TriggerDef[]>(`/triggers${params}`);
  }

  getTrigger(slug: string): Promise<TriggerDef> {
    return this.get<TriggerDef>(`/triggers/${this.e(slug)}`);
  }

  deleteTrigger(slug: string): Promise<void> {
    return this.del(`/triggers/${this.e(slug)}`);
  }

  fireTrigger(
    slug: string,
    body?: FireTriggerBody,
  ): Promise<FireTriggerResponse> {
    return this.post<FireTriggerResponse>(`/triggers/${this.e(slug)}/fire`, body);
  }

  // -- Plugins --

  createPlugin(body: CreatePluginBody): Promise<PluginDef> {
    return this.post<PluginDef>("/plugins", body);
  }

  listPlugins(tenantId?: string): Promise<PluginDef[]> {
    const params = tenantId
      ? `?${new URLSearchParams({ tenant_id: tenantId })}`
      : "";
    return this.get<PluginDef[]>(`/plugins${params}`);
  }

  getPlugin(name: string): Promise<PluginDef> {
    return this.get<PluginDef>(`/plugins/${this.e(name)}`);
  }

  updatePlugin(
    name: string,
    body: UpdatePluginBody,
  ): Promise<PluginDef> {
    return this.patch<PluginDef>(`/plugins/${this.e(name)}`, body);
  }

  deletePlugin(name: string): Promise<void> {
    return this.del(`/plugins/${this.e(name)}`);
  }

  // -- Sessions --

  createSession(body: CreateSessionBody): Promise<Session> {
    return this.post<Session>("/sessions", body);
  }

  getSession(id: string): Promise<Session> {
    return this.get<Session>(`/sessions/${this.e(id)}`);
  }

  getSessionByKey(tenantId: string, key: string): Promise<Session> {
    return this.get<Session>(`/sessions/by-key/${this.e(tenantId)}/${this.e(key)}`);
  }

  updateSessionData(
    id: string,
    body: UpdateSessionDataBody,
  ): Promise<Session> {
    return this.patch<Session>(`/sessions/${this.e(id)}/data`, body);
  }

  updateSessionState(
    id: string,
    body: UpdateSessionStateBody,
  ): Promise<Session> {
    return this.patch<Session>(`/sessions/${this.e(id)}/state`, body);
  }

  listSessionInstances(id: string): Promise<TaskInstance[]> {
    return this.get<TaskInstance[]>(`/sessions/${this.e(id)}/instances`);
  }

  // -- Workers --

  pollTasks(body: PollTasksBody): Promise<WorkerTask[]> {
    return this.post<WorkerTask[]>("/workers/tasks/poll", body);
  }

  completeTask(
    id: string,
    body: CompleteTaskBody,
  ): Promise<void> {
    return this.requestVoid("POST", `/workers/tasks/${this.e(id)}/complete`, body);
  }

  failTask(id: string, body: FailTaskBody): Promise<void> {
    return this.requestVoid("POST", `/workers/tasks/${this.e(id)}/fail`, body);
  }

  heartbeatTask(
    id: string,
    body: HeartbeatTaskBody,
  ): Promise<void> {
    return this.requestVoid("POST", `/workers/tasks/${this.e(id)}/heartbeat`, body);
  }

  listWorkerTasks(filter?: Record<string, string>): Promise<WorkerTask[]> {
    const params = filter ? `?${new URLSearchParams(filter)}` : "";
    return this.get<WorkerTask[]>(`/workers/tasks${params}`);
  }

  getWorkerTaskStats(): Promise<WorkerTaskStats> {
    return this.get<WorkerTaskStats>("/workers/tasks/stats");
  }

  // -- Circuit Breakers --

  listCircuitBreakers(): Promise<CircuitBreaker[]> {
    return this.get<CircuitBreaker[]>("/circuit-breakers");
  }

  getCircuitBreaker(handler: string): Promise<CircuitBreaker> {
    return this.get<CircuitBreaker>(`/circuit-breakers/${this.e(handler)}`);
  }

  resetCircuitBreaker(handler: string): Promise<void> {
    return this.post<void>(`/circuit-breakers/${this.e(handler)}/reset`);
  }

  listTenantCircuitBreakers(tenantId: string): Promise<CircuitBreaker[]> {
    return this.get<CircuitBreaker[]>(`/tenants/${this.e(tenantId)}/circuit-breakers`);
  }

  getTenantCircuitBreaker(
    tenantId: string,
    handler: string,
  ): Promise<CircuitBreaker> {
    return this.get<CircuitBreaker>(
      `/tenants/${this.e(tenantId)}/circuit-breakers/${this.e(handler)}`,
    );
  }

  resetTenantCircuitBreaker(
    tenantId: string,
    handler: string,
  ): Promise<void> {
    return this.post<void>(
      `/tenants/${this.e(tenantId)}/circuit-breakers/${this.e(handler)}/reset`,
    );
  }

  // -- Resource Pools --

  listPools(tenantId?: string): Promise<ResourcePool[]> {
    const params = tenantId
      ? `?${new URLSearchParams({ tenant_id: tenantId })}`
      : "";
    return this.get<ResourcePool[]>(`/pools${params}`);
  }

  createPool(body: CreatePoolBody): Promise<ResourcePool> {
    return this.post<ResourcePool>("/pools", body);
  }

  getPool(id: string): Promise<ResourcePool> {
    return this.get<ResourcePool>(`/pools/${this.e(id)}`);
  }

  deletePool(id: string): Promise<void> {
    return this.del(`/pools/${this.e(id)}`);
  }

  listPoolResources(poolId: string): Promise<PoolResource[]> {
    return this.get<PoolResource[]>(`/pools/${this.e(poolId)}/resources`);
  }

  createPoolResource(
    poolId: string,
    body: CreatePoolResourceBody,
  ): Promise<PoolResource> {
    return this.post<PoolResource>(`/pools/${this.e(poolId)}/resources`, body);
  }

  updatePoolResource(
    poolId: string,
    resourceId: string,
    body: UpdatePoolResourceBody,
  ): Promise<PoolResource> {
    return this.put<PoolResource>(
      `/pools/${this.e(poolId)}/resources/${this.e(resourceId)}`,
      body,
    );
  }

  deletePoolResource(poolId: string, resourceId: string): Promise<void> {
    return this.del(`/pools/${this.e(poolId)}/resources/${this.e(resourceId)}`);
  }

  // -- Credentials --

  listCredentials(tenantId?: string): Promise<Credential[]> {
    const params = tenantId
      ? `?${new URLSearchParams({ tenant_id: tenantId })}`
      : "";
    return this.get<Credential[]>(`/credentials${params}`);
  }

  createCredential(body: CreateCredentialBody): Promise<Credential> {
    return this.post<Credential>("/credentials", body);
  }

  getCredential(id: string): Promise<Credential> {
    return this.get<Credential>(`/credentials/${this.e(id)}`);
  }

  deleteCredential(id: string): Promise<void> {
    return this.del(`/credentials/${this.e(id)}`);
  }

  updateCredential(
    id: string,
    body: UpdateCredentialBody,
  ): Promise<Credential> {
    return this.patch<Credential>(`/credentials/${this.e(id)}`, body);
  }

  // -- Health --

  health(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health/ready");
  }
}
