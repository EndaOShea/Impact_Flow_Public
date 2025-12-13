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

export interface User {
  id: string;
  name: string;
  username: string;
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
  milestoneDescription?: string;
}

export interface ImpactMetric {
  id: string;
  type: ImpactType;
  value: number;
  achievedValue?: number;
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
  authorId: string;
  text: string;
  createdAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
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
  interval: number;
  weekDays?: number[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;

  // Ownership
  creatorId: string;

  // Scheduling
  startDate?: Date;
  dueDate?: Date;
  isRecurring: boolean;
  recurrenceConfig?: RecurrenceConfig;

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
  activityLog: ActivityLogEntry[];

  // Strategy
  okrAlignment?: string;
  okrs?: string[];
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
  name: string;

  // Trigger Configuration
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  customInterval?: number;
  weekDays?: number[];
  time: string;

  // Daily
  dailyScope?: 'TODAY' | 'YESTERDAY';

  // Monthly
  monthlyRunDay?: number;
  monthlyScope?: 'CALENDAR_MONTH' | 'ROLLING_DAYS';
  monthlyRollingValue?: number;

  // Legacy / Custom / Weekly (Calculated)
  dataRange?: string;
  rangeStartOffset: number;
  rangeEndOffset: number;

  recipients: string[];
  lastRun?: Date;
  active: boolean;
}

export type ViewState = 'DASHBOARD' | 'TASKS' | 'CALENDAR' | 'TIMELINE' | 'SETTINGS' | 'NOTIFICATIONS' | 'REPORTS' | 'ANALYTICS';
