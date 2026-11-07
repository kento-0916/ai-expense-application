export const jobTypes = ['営業', '企画', '制作', '管理', '経営'] as const;
export type JobType = (typeof jobTypes)[number];

export const appRoles = ['employee', 'accounting', 'president'] as const;
export type AppRole = (typeof appRoles)[number];

export const accountStatuses = ['pending', 'active', 'suspended'] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export type Profile = {
  id: string;
  full_name: string;
  job_type: JobType;
  app_role: AppRole;
  account_status: AccountStatus;
};
