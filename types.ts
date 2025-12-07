

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  POSTPONED = 'POSTPONED',
  FAILED = 'FAILED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ImpactType {
  REVENUE = 'Revenue',
  EFFICIENCY = 'Time Saved (Hours)',
  SATISFACTION = 'CSAT Score',
  COST_REDUCTION = 'Cost Reduction',
  RISK_MITIGATION = 'Risk Mitigation'
}

export enum WorkCategory {
  // Engineering & Product
  RESEARCH = 'Research',
  REQUIREMENTS = 'Requirements',
  DESIGN = 'Design',
  DEVELOPMENT = 'Development',
  DEBUGGING = 'Debugging',
  REVIEW = 'Review',
  TESTING = 'Testing',
  
  // Business & Operations
  STRATEGY = 'Strategy',
  MARKETING = 'Marketing',
  SALES = 'Sales',
  OPERATIONS = 'Operations',
  FINANCE = 'Finance',
  LEGAL = 'Legal',
  HR = 'HR',
  CONTENT = 'Content Creation',
  SUPPORT = 'Customer Support',
  ANALYTICS = 'Data Analytics',
  
  OTHER = 'Other'
}

export enum UserRole {
  OWNER = 'OWNER',             // Creator of the Organization (Super Admin)
  ADMIN = 'ADMIN',             // Organization Administrator
  TEAM_ADMIN = 'TEAM_ADMIN',   // Manages a specific team
  USER = 'USER',               // Standard User
  SYSTEM_ADMIN = 'SYSTEM_ADMIN' // Platform Owner (Outside Org)
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface JoinRequest {
  id: string;
  userId: string;
  organizationId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  username?: string;
  name?: string;
}

export interface TaskAssignmentRequest {
  id: string;
  organizationId: string;
  taskId: string;
  taskTitle: string;
  requesterId: string; // The Team Admin asking
  targetUserId: string; // The user in another team
  targetTeamId: string; // The team ID of the target user (for filtering who approves)
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  color: string; // e.g., 'bg-blue-500'
}

export interface User {
  id: string;
  organizationId?: string | null; // Null if not in an org yet
  organizationName?: string | null; // Organization name (from backend)
  organizationBannerUrl?: string | null; // Organization banner (from backend)
  name: string;
  username: string; // Login ID
  passwordHash?: string; // Hashed password (Argon2)
  recoveryKey?: string; // RK-XXXX-XXXX-XXXX
  role: UserRole;
  teamIds: string[]; // Support multiple teams
  avatarInitials: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  hoursSpent: number;
  estimatedHours: number;
  category: WorkCategory;
  notes: string;
  isMilestone?: boolean;
  milestoneDescription?: string; // Description of what the milestone represents
}

export interface ImpactMetric {
  id: string;
  type: ImpactType;
  value: number; // Target Value
  achievedValue?: number; // Current Progress
  currency?: 'USD' | 'EUR' | 'GBP';
  description: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  createdAt: Date;
}

export interface Comment {
  id: string;
  authorId: string; // Link to User ID
  text: string;
  createdAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string; // Snapshot of name in case user is deleted later
  action: string;   // e.g. "Changed status to In Progress"
  timestamp: Date;
}

export interface AutomationRule {
  id: string;
  trigger: string; 
  action: string; 
  active: boolean;
}

export interface RecurrenceConfig {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number; // e.g. every 2 weeks
  weekDays?: number[]; // 0=Sun, 1=Mon, etc. (For Weekly)
}

export interface Task {
  id: string;
  organizationId: string; // Partition data by Org
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  
  // Ownership & Permissions
  creatorId: string; // The user who created the task
  adminIds: string[]; // Users granted admin rights on this task
  
  // Scheduling
  startDate?: Date;
  dueDate?: Date;
  isRecurring: boolean;
  recurrenceConfig?: RecurrenceConfig;
  
  // People
  assigneeIds: string[]; // List of Users doing the work
  pendingAssigneeId?: string; // If waiting for approval (Singular request flow for simplicity)
  assignedTeamId?: string; // Optional: Assign to a whole team
  
  // Relationships
  dependencyIds: string[]; 
  
  // Timestamps
  createdAt: Date;
  completedAt?: Date;
  
  // Detailed Data
  subtasks: Subtask[];
  impactMetrics: ImpactMetric[];
  attachments: Attachment[];
  comments: Comment[];
  activityLog: ActivityLogEntry[]; // <-- Added Activity Log
  
  // Strategy & Diagrams
  diagramCode?: string;
  okrAlignment?: string; // @deprecated in favor of okrs array
  okrs?: string[]; // Multiple OKRs
  milestone?: boolean;
  
  // Impact Narrative
  beforeScenario?: string;
  afterScenario?: string;
  impactNarrative?: string;
  
  // Automation
  automations: AutomationRule[];
  
  // External Links
  resourceLinks: { title: string; url: string }[];
}

export interface SupportTicket {
    id: string;
    userId: string;
    subject: string;
    message: string;
    status: 'OPEN' | 'RESOLVED';
    createdAt: Date;
}

export interface ReportSchedule {
    id: string;
    organizationId: string;
    name: string;
    
    // Trigger Configuration
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    customInterval?: number; // For 'Every X days'
    weekDays?: number[]; // For 'Weekly' (0=Sun, 1=Mon...)
    time: string; // "09:00"

    // --- Specific Configs ---
    
    // Daily
    dailyScope?: 'TODAY' | 'YESTERDAY';

    // Monthly
    monthlyRunDay?: number; // 1-31, 32=Last Day
    monthlyScope?: 'CALENDAR_MONTH' | 'ROLLING_DAYS';
    monthlyRollingValue?: number; // e.g. 30 days

    // Legacy / Custom / Weekly (Calculated)
    dataRange?: string; // Deprecated
    rangeStartOffset: number; // "Days to go back" (e.g. 7 means 7 days ago)
    rangeEndOffset: number;   // "Anchor Date" (e.g. 0 means Today)
    
    recipients: string[]; 
    lastRun?: Date;
    active: boolean;
}

export type ViewState = 'DASHBOARD' | 'TASKS' | 'CALENDAR' | 'TIMELINE' | 'ADMIN' | 'NOTIFICATIONS' | 'REPORTS' | 'PLATFORM_ADMIN';