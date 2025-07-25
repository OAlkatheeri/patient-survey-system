-- Safe Database Schema - Handles existing components gracefully
-- Run this instead of database_schema.sql

-- Create custom enum types (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    END IF;
END $$;

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create clinics table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.clinics (
  id character varying(50) NOT NULL,
  name character varying(200) NOT NULL,
  location character varying(300) NOT NULL,
  description text,
  phone character varying(50),
  email character varying(200),
  manager_id uuid,
  departments text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinics_pkey PRIMARY KEY (id)
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'clinics_manager_id_fkey'
    ) THEN
        ALTER TABLE public.clinics 
        ADD CONSTRAINT clinics_manager_id_fkey 
        FOREIGN KEY (manager_id) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes for clinics if they don't exist
CREATE INDEX IF NOT EXISTS idx_clinics_manager_id ON public.clinics USING btree (manager_id);
CREATE INDEX IF NOT EXISTS idx_clinics_is_active ON public.clinics USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_clinics_name ON public.clinics USING btree (name);

-- Create trigger for clinics updated_at (drop and recreate to be safe)
DROP TRIGGER IF EXISTS update_clinics_updated_at ON clinics;
CREATE TRIGGER update_clinics_updated_at 
  BEFORE UPDATE ON clinics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure clinic_survey_responses table exists with correct structure
CREATE TABLE IF NOT EXISTS public.clinic_survey_responses (
  id bigserial NOT NULL,
  response_id character varying(100) NOT NULL,
  patient_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_preferences jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinic_survey_responses_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_survey_responses_response_id_key UNIQUE (response_id)
);

-- Create indexes for clinic_survey_responses if they don't exist
CREATE INDEX IF NOT EXISTS idx_survey_responses_clinic_id ON public.clinic_survey_responses 
  USING btree (((patient_info ->> 'clinic_location'::text)));

CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.clinic_survey_responses 
  USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_survey_responses_satisfaction ON public.clinic_survey_responses 
  USING btree (((responses ->> 'overall_satisfaction'::text)));

CREATE INDEX IF NOT EXISTS idx_survey_responses_patient_name ON public.clinic_survey_responses 
  USING gin (((patient_info ->> 'full_name'::text)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_survey_responses_patient_email ON public.clinic_survey_responses 
  USING btree (((patient_info ->> 'email'::text)));

CREATE INDEX IF NOT EXISTS idx_survey_responses_patient_info ON public.clinic_survey_responses 
  USING gin (patient_info);

CREATE INDEX IF NOT EXISTS idx_survey_responses_responses ON public.clinic_survey_responses 
  USING gin (responses);

-- Ensure users table exists (may already exist from your schema)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  username character varying(50) NOT NULL,
  email character varying(200) NOT NULL,
  full_name character varying(200) NOT NULL,
  role public.user_role DEFAULT 'user'::user_role,
  is_active boolean DEFAULT true,
  created_by uuid,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add constraints to users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_pkey'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_auth_user_id_key'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_email_key'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_username_key'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_created_by_fkey'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes for users if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);

-- Ensure follow_up_tasks table exists
CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
  id bigserial NOT NULL,
  survey_response_id bigint,
  patient_name character varying(200) NOT NULL,
  patient_email character varying(200),
  patient_phone character varying(50),
  clinic_id character varying(50),
  priority public.task_priority DEFAULT 'medium'::task_priority,
  status public.task_status DEFAULT 'pending'::task_status,
  survey_type character varying(50) DEFAULT 'clinic_satisfaction'::character varying,
  overall_satisfaction character varying(50),
  title character varying(300),
  notes text,
  assigned_to uuid,
  assigned_at timestamp with time zone,
  resolution_notes text,
  resolved_at timestamp with time zone,
  due_date timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  contact_method_preferences jsonb,
  CONSTRAINT follow_up_tasks_pkey PRIMARY KEY (id)
);

-- Add foreign key constraints to follow_up_tasks if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'follow_up_tasks_assigned_to_fkey'
    ) THEN
        ALTER TABLE public.follow_up_tasks ADD CONSTRAINT follow_up_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'follow_up_tasks_clinic_id_fkey'
    ) THEN
        ALTER TABLE public.follow_up_tasks ADD CONSTRAINT follow_up_tasks_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'follow_up_tasks_created_by_fkey'
    ) THEN
        ALTER TABLE public.follow_up_tasks ADD CONSTRAINT follow_up_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'follow_up_tasks_survey_response_id_fkey'
    ) THEN
        ALTER TABLE public.follow_up_tasks ADD CONSTRAINT follow_up_tasks_survey_response_id_fkey 
        FOREIGN KEY (survey_response_id) REFERENCES clinic_survey_responses(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for follow_up_tasks if they don't exist
CREATE INDEX IF NOT EXISTS idx_followup_tasks_clinic_id ON public.follow_up_tasks USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_status ON public.follow_up_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_assigned_to ON public.follow_up_tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_created_at ON public.follow_up_tasks USING btree (created_at);

-- Create triggers for updated_at columns (drop and recreate to be safe)
DROP TRIGGER IF EXISTS update_survey_responses_updated_at ON clinic_survey_responses;
CREATE TRIGGER update_survey_responses_updated_at 
  BEFORE UPDATE ON clinic_survey_responses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_followup_tasks_updated_at ON follow_up_tasks;
CREATE TRIGGER update_followup_tasks_updated_at 
  BEFORE UPDATE ON follow_up_tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample clinics data (only if they don't exist)
INSERT INTO public.clinics (id, name, location, description, is_active) VALUES
('uaeu_main', 'UAEU Main Campus Clinic', 'Al Ain', 'Main campus medical facility', true),
('uaeu_medical', 'UAEU Medical Campus Clinic', 'Al Ain', 'Medical campus specialized clinic', true),
('ega_dubai', 'EGA Dubai Clinic', 'Dubai', 'Emirates Global Aluminium Dubai facility', true),
('ega_abudhabi', 'EGA Abu Dhabi Clinic', 'Abu Dhabi', 'Emirates Global Aluminium Abu Dhabi facility', true),
('uaeu_alain', 'UAEU Al Ain Campus Clinic', 'Al Ain', 'Al Ain campus medical center', true)
ON CONFLICT (id) DO NOTHING;

-- Auto-create follow-up task function
CREATE OR REPLACE FUNCTION auto_create_followup_task()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called by the survey submission
    -- The actual logic is handled in the JavaScript code
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for auto follow-up task creation (drop and recreate to be safe)
DROP TRIGGER IF EXISTS auto_create_followup_task_trigger ON clinic_survey_responses;
CREATE TRIGGER auto_create_followup_task_trigger
  AFTER INSERT ON clinic_survey_responses 
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_followup_task();

-- Create a view for easier querying (drop and recreate to be safe)
DROP VIEW IF EXISTS survey_responses_view;
CREATE VIEW survey_responses_view AS
SELECT 
    csr.id,
    csr.response_id,
    csr.patient_info->>'full_name' as patient_name,
    csr.patient_info->>'email' as patient_email,
    csr.patient_info->>'phone' as patient_phone,
    csr.patient_info->>'visit_date' as visit_date,
    csr.patient_info->>'clinic_location' as clinic_id,
    csr.responses->>'overall_satisfaction' as overall_satisfaction,
    csr.responses->>'reception_satisfaction' as reception_satisfaction,
    csr.responses->>'nursing_professionalism' as nursing_professionalism,
    csr.responses->>'doctor_satisfaction' as doctor_satisfaction,
    csr.responses->>'clinic_cleanliness' as clinic_cleanliness,
    csr.responses->>'waiting_time_acceptable' as waiting_time_acceptable,
    csr.responses->>'recommendation_likelihood' as recommendation_likelihood,
    csr.contact_preferences->>'wants_contact' as wants_contact,
    csr.contact_preferences->'contact_methods' as contact_methods,
    c.name as clinic_name,
    c.location as clinic_location_name,
    csr.created_at,
    csr.updated_at,
    csr.patient_info,
    csr.responses,
    csr.contact_preferences,
    csr.metadata
FROM clinic_survey_responses csr
LEFT JOIN clinics c ON c.id = csr.patient_info->>'clinic_location';

-- Function to get user accessible clinics
CREATE OR REPLACE FUNCTION get_user_accessible_clinics()
RETURNS TABLE(clinic_id text, clinic_name text) AS $$
BEGIN
    -- For now, return all active clinics
    -- You can modify this to implement proper user-clinic access control
    RETURN QUERY
    SELECT c.id::text, c.name
    FROM clinics c
    WHERE c.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema updated successfully! All components are now compatible.';
END $$;