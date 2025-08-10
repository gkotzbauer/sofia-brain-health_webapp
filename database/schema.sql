-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE confidence_level AS ENUM ('Very confident', 'Somewhat confident', 'Not very confident');
CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE safety_trigger_type AS ENUM ('emergency', 'distress', 'frustration', 'repetition', 'inclusion');
CREATE TYPE goal_status AS ENUM ('active', 'completed', 'paused', 'abandoned');

-- Users table (basic profile)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    age VARCHAR(10),
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_visit TIMESTAMP WITH TIME ZONE,
    total_sessions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- About Me Profile (encrypted for PHI)
CREATE TABLE about_me_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    best_life_elements JSONB DEFAULT '[]'::jsonb,
    concerns JSONB DEFAULT '[]'::jsonb,
    confidence_level confidence_level,
    confidence_timestamp TIMESTAMP WITH TIME ZONE,
    user_defined_next_steps JSONB DEFAULT '[]'::jsonb,
    profile_completeness INTEGER DEFAULT 0,
    update_frequency VARCHAR(50) DEFAULT 'monthly',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER,
    main_topics TEXT[],
    goals_set UUID[],
    mood VARCHAR(50),
    notes JSONB DEFAULT '[]'::jsonb,
    conversation_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Story Chapters
CREATE TABLE story_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    moment TEXT,
    mood_arc TEXT[],
    choices TEXT,
    learning TEXT,
    linked_best_life_elements TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10),
    status goal_status DEFAULT 'active',
    linked_best_life_elements TEXT[],
    user_note TEXT,
    last_edited TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goal Progress
CREATE TABLE goal_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    progress_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress_note TEXT,
    confidence_update INTEGER CHECK (confidence_update >= 1 AND confidence_update <= 10)
);

-- Values
CREATE TABLE values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value_text TEXT NOT NULL,
    importance VARCHAR(50) DEFAULT 'high',
    user_note TEXT,
    last_edited TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Concerns
CREATE TABLE concerns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concern TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'moderate',
    context TEXT,
    user_note TEXT,
    last_edited TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Education Topics
CREATE TABLE education_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    engagement VARCHAR(50) DEFAULT 'moderate',
    user_note TEXT,
    last_edited TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Feedback (User Thoughts)
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    feedback_text TEXT NOT NULL,
    conversation_context INTEGER,
    sentiment_score DECIMAL(3,2),
    is_reviewed BOOLEAN DEFAULT false,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safety Events
CREATE TABLE safety_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    trigger_type safety_trigger_type NOT NULL,
    severity risk_level NOT NULL,
    keywords TEXT[],
    context TEXT,
    clinician_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    intervention_required BOOLEAN DEFAULT false,
    intervention_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safety Interventions
CREATE TABLE safety_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    safety_event_id UUID NOT NULL REFERENCES safety_events(id) ON DELETE CASCADE,
    urgency VARCHAR(50),
    intervention_type VARCHAR(100),
    clinician_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log (for HIPAA compliance)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clinical Alerts Queue
CREATE TABLE clinical_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    safety_event_id UUID REFERENCES safety_events(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    priority risk_level NOT NULL,
    message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Upload History (for audit trail)
CREATE TABLE document_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    extracted_count INTEGER DEFAULT 0,
    applied_count INTEGER DEFAULT 0,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Profile Variable History (tracks all updates with sources)
CREATE TABLE profile_variable_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variable_name VARCHAR(255) NOT NULL,
    variable_value TEXT,
    previous_value TEXT,
    source VARCHAR(100) DEFAULT 'manual', -- manual, document, api, import
    source_details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(100) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_date ON sessions(session_date);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_safety_events_user ON safety_events(user_id);
CREATE INDEX idx_safety_events_severity ON safety_events(severity);
CREATE INDEX idx_safety_events_created ON safety_events(created_at);
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_clinical_alerts_priority ON clinical_alerts(priority, is_sent);
CREATE INDEX idx_document_uploads_user ON document_uploads(user_id);
CREATE INDEX idx_profile_variable_history_user ON profile_variable_history(user_id, variable_name);
CREATE INDEX idx_profile_variable_history_timestamp ON profile_variable_history(timestamp);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_about_me_profiles_updated_at BEFORE UPDATE ON about_me_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_chapters_updated_at BEFORE UPDATE ON story_chapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();