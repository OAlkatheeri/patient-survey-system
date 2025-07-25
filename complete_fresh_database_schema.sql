-- Complete Fresh Database Schema for Clinic Survey System
-- Run this on a clean database (all tables dropped)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom enum types
CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create users table first (no dependencies)
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid,
  username character varying(50) NOT NULL,
  email character varying(200) NOT NULL,
  full_name character varying(200) NOT NULL,
  role public.user_role DEFAULT 'user'::user_role,
  is_active boolean DEFAULT true,
  created_by uuid,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for users
CREATE INDEX idx_users_auth_user_id ON public.users USING btree (auth_user_id);
CREATE INDEX idx_users_username ON public.users USING btree (username);
CREATE INDEX idx_users_role ON public.users USING btree (role);

-- Create trigger for users updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create clinics table (depends on users for manager_id)
CREATE TABLE public.clinics (
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
  CONSTRAINT clinics_pkey PRIMARY KEY (id),
  CONSTRAINT clinics_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Create indexes for clinics
CREATE INDEX idx_clinics_manager_id ON public.clinics USING btree (manager_id);
CREATE INDEX idx_clinics_is_active ON public.clinics USING btree (is_active);
CREATE INDEX idx_clinics_name ON public.clinics USING btree (name);

-- Create trigger for clinics updated_at
CREATE TRIGGER update_clinics_updated_at 
  BEFORE UPDATE ON clinics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create clinic_survey_responses table
CREATE TABLE public.clinic_survey_responses (
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

-- Create indexes for clinic_survey_responses
CREATE INDEX idx_survey_responses_clinic_id ON public.clinic_survey_responses 
  USING btree (((patient_info ->> 'clinic_location'::text)));

CREATE INDEX idx_survey_responses_created_at ON public.clinic_survey_responses 
  USING btree (created_at);

CREATE INDEX idx_survey_responses_satisfaction ON public.clinic_survey_responses 
  USING btree (((responses ->> 'overall_satisfaction'::text)));

CREATE INDEX idx_survey_responses_patient_name ON public.clinic_survey_responses 
  USING gin (((patient_info ->> 'full_name'::text)) gin_trgm_ops);

CREATE INDEX idx_survey_responses_patient_email ON public.clinic_survey_responses 
  USING btree (((patient_info ->> 'email'::text)));

CREATE INDEX idx_survey_responses_patient_info ON public.clinic_survey_responses 
  USING gin (patient_info);

CREATE INDEX idx_survey_responses_responses ON public.clinic_survey_responses 
  USING gin (responses);

-- Create trigger for clinic_survey_responses updated_at
CREATE TRIGGER update_survey_responses_updated_at 
  BEFORE UPDATE ON clinic_survey_responses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create follow_up_tasks table (depends on users and clinics and clinic_survey_responses)
CREATE TABLE public.follow_up_tasks (
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
  CONSTRAINT follow_up_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT follow_up_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT follow_up_tasks_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id),
  CONSTRAINT follow_up_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT follow_up_tasks_survey_response_id_fkey FOREIGN KEY (survey_response_id) 
    REFERENCES clinic_survey_responses(id) ON DELETE SET NULL
);

-- Create indexes for follow_up_tasks
CREATE INDEX idx_followup_tasks_clinic_id ON public.follow_up_tasks USING btree (clinic_id);
CREATE INDEX idx_followup_tasks_status ON public.follow_up_tasks USING btree (status);
CREATE INDEX idx_followup_tasks_assigned_to ON public.follow_up_tasks USING btree (assigned_to);
CREATE INDEX idx_followup_tasks_created_at ON public.follow_up_tasks USING btree (created_at);

-- Create trigger for follow_up_tasks updated_at
CREATE TRIGGER update_followup_tasks_updated_at 
  BEFORE UPDATE ON follow_up_tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users (needed before clinics with managers)
INSERT INTO public.users (id, username, email, full_name, role, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin1', 'admin1@clinic.com', 'Dr. Ahmed Al-Rashid', 'admin', true),
('550e8400-e29b-41d4-a716-446655440002', 'admin2', 'admin2@clinic.com', 'Dr. Fatima Al-Zahra', 'admin', true),
('550e8400-e29b-41d4-a716-446655440003', 'admin3', 'admin3@clinic.com', 'Dr. Mohammed Hassan', 'admin', true),
('550e8400-e29b-41d4-a716-446655440004', 'superadmin', 'super@clinic.com', 'System Administrator', 'super_admin', true),
('550e8400-e29b-41d4-a716-446655440005', 'user1', 'user1@clinic.com', 'Nurse Sarah Johnson', 'user', true);

-- Insert sample clinics data with managers
INSERT INTO public.clinics (id, name, location, description, manager_id, departments, phone, email, is_active) VALUES
('uaeu_main', 'UAEU Main Campus Clinic', 'Al Ain', 'Main campus medical facility', '550e8400-e29b-41d4-a716-446655440001', 'General Medicine, Cardiology, Dermatology', '+971-3-7134567', 'main@uaeu.ac.ae', true),
('uaeu_medical', 'UAEU Medical Campus Clinic', 'Al Ain', 'Medical campus specialized clinic', '550e8400-e29b-41d4-a716-446655440002', 'Internal Medicine, Pediatrics, Gynecology', '+971-3-7134568', 'medical@uaeu.ac.ae', true),
('ega_dubai', 'EGA Dubai Clinic', 'Dubai', 'Emirates Global Aluminium Dubai facility', '550e8400-e29b-41d4-a716-446655440003', 'Occupational Health, Emergency Care', '+971-4-2345678', 'health@ega.ae', true),
('ega_abudhabi', 'EGA Abu Dhabi Clinic', 'Abu Dhabi', 'Emirates Global Aluminium Abu Dhabi facility', '550e8400-e29b-41d4-a716-446655440001', 'Occupational Health, General Medicine', '+971-2-3456789', 'abudhabi@ega.ae', true),
('uaeu_alain', 'UAEU Al Ain Campus Clinic', 'Al Ain', 'Al Ain campus medical center', '550e8400-e29b-41d4-a716-446655440002', 'Family Medicine, Psychiatry, Nutrition', '+971-3-7134569', 'alain@uaeu.ac.ae', true);

-- Auto-create follow-up task function
CREATE OR REPLACE FUNCTION auto_create_followup_task()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called by the survey submission
    -- The actual logic is handled in the JavaScript code
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for auto follow-up task creation
CREATE TRIGGER auto_create_followup_task_trigger
  AFTER INSERT ON clinic_survey_responses 
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_followup_task();

-- Create a view for easier querying
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
    csr.responses->>'visit_type' as visit_type,
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

-- Insert some sample survey responses for testing
INSERT INTO public.clinic_survey_responses (
    response_id, 
    patient_info, 
    responses, 
    contact_preferences, 
    metadata
) VALUES 
(
    'CLINIC_1704067200_abc123456',
    '{"full_name": "Ahmed Mohammed Al-Rashid", "email": "ahmed.rashid@email.com", "phone": "+971501234567", "visit_date": "2024-01-15", "clinic_location": "uaeu_main"}',
    '{"overall_satisfaction": "very_satisfied", "reception_satisfaction": "satisfied", "nursing_professionalism": "very_satisfied", "doctor_satisfaction": "very_satisfied", "clinic_cleanliness": "satisfied", "waiting_time_acceptable": "yes", "recommendation_likelihood": "very_likely", "visit_type": "first_visit", "reception_comments": "Very friendly and helpful staff", "doctor_comments": "Doctor was very thorough and explained everything clearly"}',
    '{"wants_contact": "no", "contact_methods": []}',
    '{"submission_timestamp": "2024-01-15T10:30:00Z", "survey_version": "2.1", "clinic": "uaeu_main"}'
),
(
    'CLINIC_1704153600_def789012',
    '{"full_name": "Fatima Ali Hassan", "email": "fatima.hassan@email.com", "phone": "+971509876543", "visit_date": "2024-01-16", "clinic_location": "uaeu_medical"}',
    '{"overall_satisfaction": "dissatisfied", "reception_satisfaction": "neutral", "nursing_professionalism": "satisfied", "doctor_satisfaction": "dissatisfied", "clinic_cleanliness": "neutral", "waiting_time_acceptable": "no", "recommendation_likelihood": "unlikely", "visit_type": "follow_up", "doctor_comments": "Doctor seemed rushed and did not listen to my concerns", "environment_comments": "Waiting area was too crowded"}',
    '{"wants_contact": "yes", "contact_methods": ["email", "phone"]}',
    '{"submission_timestamp": "2024-01-16T14:20:00Z", "survey_version": "2.1", "clinic": "uaeu_medical"}'
),
(
    'CLINIC_1704240000_ghi345678',
    '{"full_name": "Mohammed Saeed Al-Mansoori", "email": "mohammed.mansoori@email.com", "phone": "+971505551234", "visit_date": "2024-01-17", "clinic_location": "ega_dubai"}',
    '{"overall_satisfaction": "satisfied", "reception_satisfaction": "very_satisfied", "nursing_professionalism": "satisfied", "doctor_satisfaction": "satisfied", "clinic_cleanliness": "very_satisfied", "waiting_time_acceptable": "yes", "recommendation_likelihood": "likely", "visit_type": "routine_checkup", "reception_comments": "Excellent service at reception", "nursing_comments": "Nurses were professional and caring"}',
    '{"wants_contact": "yes", "contact_methods": ["email"]}',
    '{"submission_timestamp": "2024-01-17T09:15:00Z", "survey_version": "2.1", "clinic": "ega_dubai"}'
);

-- Create some sample follow-up tasks
INSERT INTO public.follow_up_tasks (
    survey_response_id,
    patient_name,
    patient_email,
    patient_phone,
    clinic_id,
    priority,
    status,
    overall_satisfaction,
    title,
    notes,
    due_date,
    contact_method_preferences
) VALUES 
(
    2, -- References the dissatisfied patient
    'Fatima Ali Hassan',
    'fatima.hassan@email.com',
    '+971509876543',
    'uaeu_medical',
    'high',
    'pending',
    'dissatisfied',
    'Follow-up: Fatima Ali Hassan - Dissatisfied',
    'Auto-generated: Dissatisfied patient requires immediate attention',
    NOW() + INTERVAL '24 hours',
    '["email", "phone"]'
),
(
    3, -- References the patient who wants contact
    'Mohammed Saeed Al-Mansoori',
    'mohammed.mansoori@email.com',
    '+971505551234',
    'ega_dubai',
    'medium',
    'pending',
    'satisfied',
    'Follow-up: Mohammed Saeed Al-Mansoori - Contact Requested',
    'Auto-generated: Patient requested contact via email',
    NOW() + INTERVAL '48 hours',
    '["email"]'
);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Complete fresh database schema created successfully!';
    RAISE NOTICE '📊 Sample users, clinics, and survey responses have been added.';
    RAISE NOTICE '👥 Sample users created:';
    RAISE NOTICE '   - super@clinic.com (Super Admin)';
    RAISE NOTICE '   - admin1@clinic.com (Dr. Ahmed Al-Rashid)';
    RAISE NOTICE '   - admin2@clinic.com (Dr. Fatima Al-Zahra)';
    RAISE NOTICE '   - admin3@clinic.com (Dr. Mohammed Hassan)';
    RAISE NOTICE '🏥 5 sample clinics created with proper management assignments';
    RAISE NOTICE '📝 3 sample survey responses created for testing';
    RAISE NOTICE '📋 2 sample follow-up tasks created';
    RAISE NOTICE '🚀 System is ready for use!';
END $$;