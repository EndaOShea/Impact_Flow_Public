-- Migration: Add project colors and date validation
-- Created: 2026-01-09
-- Description: Adds color field to projects and date validation constraints to both projects and tasks

-- Add color column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#8b5cf6';

-- Add date validation constraints to projects
ALTER TABLE projects
ADD CONSTRAINT chk_project_dates CHECK (target_end_date IS NULL OR start_date IS NULL OR target_end_date >= start_date);

ALTER TABLE projects
ADD CONSTRAINT chk_project_actual_dates CHECK (actual_end_date IS NULL OR start_date IS NULL OR actual_end_date >= start_date);

-- Add date validation constraint to tasks
ALTER TABLE tasks
ADD CONSTRAINT chk_task_dates CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);

-- Update existing projects without a color to use default purple
UPDATE projects SET color = '#8b5cf6' WHERE color IS NULL;
