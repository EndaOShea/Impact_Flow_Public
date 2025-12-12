-- Impact Flow Database Schema (Single User)
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS (Single user system - only one user expected)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, -- Argon2id hash
    recovery_key VARCHAR(50) UNIQUE, -- RK-XXXX-XXXX-XXXX format
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_initials VARCHAR(5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_recovery ON users(recovery_key);

-- ============================================================================
-- TASKS
-- ============================================================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'TODO',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',

    -- Ownership
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Scheduling
    start_date DATE,
    due_date DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_config JSONB, -- {frequency, interval, weekDays}

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Strategy & Documentation
    diagram_code TEXT,
    okrs JSONB DEFAULT '[]'::jsonb, -- Array of strings
    okr_alignment VARCHAR(500), -- Legacy field
    milestone BOOLEAN DEFAULT FALSE,
    before_scenario TEXT,
    after_scenario TEXT,
    impact_narrative TEXT,
    resource_links JSONB DEFAULT '[]'::jsonb, -- [{title, url}]

    CONSTRAINT chk_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE', 'POSTPONED', 'FAILED')),
    CONSTRAINT chk_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX idx_tasks_creator ON tasks(creator_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================================================
-- TASK DEPENDENCIES (Many-to-Many)
-- ============================================================================
CREATE TABLE task_dependencies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (task_id, depends_on_task_id),
    CONSTRAINT chk_no_self_dependency CHECK (task_id != depends_on_task_id)
);

CREATE INDEX idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends ON task_dependencies(depends_on_task_id);

-- ============================================================================
-- SUBTASKS
-- ============================================================================
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    hours_spent DECIMAL(10,2) DEFAULT 0,
    estimated_hours DECIMAL(10,2) DEFAULT 0,
    category VARCHAR(100) NOT NULL DEFAULT 'Development',
    notes TEXT,
    is_milestone BOOLEAN DEFAULT FALSE,
    milestone_description TEXT,
    position INTEGER NOT NULL DEFAULT 0, -- For ordering
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_subtasks_position ON subtasks(task_id, position);

-- ============================================================================
-- IMPACT METRICS
-- ============================================================================
CREATE TABLE impact_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    achieved_value DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_impact_metrics_task ON impact_metrics(task_id);

-- ============================================================================
-- ATTACHMENTS
-- ============================================================================
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(100),
    url TEXT NOT NULL, -- S3 URL or data URL for now
    size BIGINT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_task ON attachments(task_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL, -- Snapshot
    action TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_task ON activity_log(task_id);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);

-- ============================================================================
-- AUTOMATION RULES
-- ============================================================================
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    trigger VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_task ON automation_rules(task_id);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_ticket_status CHECK (status IN ('OPEN', 'RESOLVED'))
);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- ============================================================================
-- REPORT SCHEDULES
-- ============================================================================
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    custom_interval INTEGER,
    week_days JSONB,
    time VARCHAR(10) NOT NULL,
    daily_scope VARCHAR(50),
    monthly_run_day INTEGER,
    monthly_scope VARCHAR(50),
    monthly_rolling_value INTEGER,
    data_range VARCHAR(100),
    range_start_offset INTEGER DEFAULT 0,
    range_end_offset INTEGER DEFAULT 0,
    recipients JSONB DEFAULT '[]'::jsonb,
    last_run TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_frequency CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'))
);

CREATE INDEX idx_report_schedules_user ON report_schedules(user_id);
CREATE INDEX idx_report_schedules_active ON report_schedules(active);

-- ============================================================================
-- API KEYS (Encrypted per user)
-- ============================================================================
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL, -- e.g., 'gemini', 'openai'
    encrypted_key TEXT NOT NULL, -- Encrypted with server-side secret
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_user_service UNIQUE(user_id, service_name)
);

CREATE INDEX idx_api_keys_user ON user_api_keys(user_id);

-- ============================================================================
-- SESSIONS (For authentication)
-- ============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of session token
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- AUDIT LOG (Security & Compliance)
-- ============================================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATE_TASK', etc.
    resource_type VARCHAR(50), -- 'task', 'user'
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_impact_metrics_updated_at BEFORE UPDATE ON impact_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at BEFORE UPDATE ON report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-set task status to OVERDUE
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
BEGIN
    UPDATE tasks
    SET status = 'OVERDUE'
    WHERE due_date < CURRENT_DATE
      AND status NOT IN ('COMPLETED', 'FAILED', 'POSTPONED', 'OVERDUE');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Tasks with full information
CREATE VIEW tasks_full AS
SELECT
    t.*,
    u_creator.name as creator_name
FROM tasks t
LEFT JOIN users u_creator ON t.creator_id = u_creator.id;
