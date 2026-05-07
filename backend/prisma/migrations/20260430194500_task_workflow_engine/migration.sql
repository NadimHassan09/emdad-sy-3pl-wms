-- Task / workflow engine (additive): maps Prisma enums @@map(...) and @@map table names.

CREATE TYPE worker_operational_status AS ENUM ('active', 'inactive');
CREATE TYPE worker_operational_role AS ENUM ('picker', 'packer', 'qa', 'receiver', 'dispatcher');
CREATE TYPE workflow_reference_type AS ENUM ('inbound_order', 'outbound_order');
CREATE TYPE workflow_instance_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE workflow_node_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
CREATE TYPE workflow_step_kind AS ENUM ('receiving', 'qc', 'putaway', 'pick', 'pack', 'dispatch', 'routing');
CREATE TYPE warehouse_task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'blocked', 'cancelled', 'failed');
CREATE TYPE warehouse_task_type AS ENUM ('receiving', 'qc', 'putaway', 'pick', 'pack', 'dispatch', 'routing');

CREATE TABLE ledger_idempotency (
    idempotency_key VARCHAR(512) PRIMARY KEY,
    ledger_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    warehouse_id UUID REFERENCES warehouses(id),
    display_name TEXT NOT NULL,
    user_id UUID UNIQUE REFERENCES users(id),
    status worker_operational_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workers_company_id_idx ON workers(company_id);
CREATE INDEX workers_warehouse_id_idx ON workers(warehouse_id);

CREATE TABLE worker_role_assignments (
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    role worker_operational_role NOT NULL,
    CONSTRAINT worker_role_assignments_pkey PRIMARY KEY (worker_id, role)
);

CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    reference_type workflow_reference_type NOT NULL,
    reference_id UUID NOT NULL,
    definition_code TEXT NOT NULL,
    status workflow_instance_status NOT NULL DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workflow_instances_company_id_idx ON workflow_instances(company_id);
CREATE INDEX workflow_instances_reference_idx ON workflow_instances(reference_type, reference_id);

CREATE TABLE workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_kind workflow_step_kind NOT NULL,
    status workflow_node_status NOT NULL DEFAULT 'pending',
    sequence INT NOT NULL,
    parent_node_id UUID REFERENCES workflow_nodes(id),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workflow_nodes_instance_id_idx ON workflow_nodes(instance_id);

CREATE TABLE warehouse_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    workflow_node_id UUID REFERENCES workflow_nodes(id),
    task_type warehouse_task_type NOT NULL,
    status warehouse_task_status NOT NULL DEFAULT 'pending',
    priority INT NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    payload_schema_version INT NOT NULL DEFAULT 1,
    lock_version INT NOT NULL DEFAULT 0,
    correlation_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    failure_reason TEXT,
    execution_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX warehouse_tasks_instance_id_idx ON warehouse_tasks(workflow_instance_id);
CREATE INDEX warehouse_tasks_status_task_type_idx ON warehouse_tasks(status, task_type);

CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES warehouse_tasks(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    unassigned_at TIMESTAMPTZ
);
CREATE INDEX task_assignments_worker_id_idx ON task_assignments(worker_id);
CREATE INDEX task_assignments_task_id_idx ON task_assignments(task_id);

CREATE TABLE task_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES warehouse_tasks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX task_events_task_id_idx ON task_events(task_id);
