-- Add new partner-scoped roles for managers and employees
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNER_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNER_EMPLOYEE';
