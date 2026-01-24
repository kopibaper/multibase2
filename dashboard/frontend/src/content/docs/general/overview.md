# Multibase Dashboard - Overview

Welcome to **Multibase**, a self-hosted management dashboard for running multiple Supabase instances.

![Dashboard Overview](/screenshots/dashboard-overview.png)

---

## What is Multibase?

Multibase is a powerful web-based dashboard that allows you to:

- **Manage Multiple Supabase Instances**
  - Create new instances with one click
  - Start, stop, and restart instances
  - Delete instances when no longer needed
- **Monitor in Real-Time**
  - View CPU and memory usage
  - Check health status of all services
  - Stream live logs
- **Handle Backups**
  - Schedule automated backups
  - Configure retention policies
  - One-click restore
- **Receive Alerts**
  - Set threshold-based rules
  - Get notified via email or webhook
  - Track alert history
- **Secure Access**
  - Multi-user support with roles
  - Two-factor authentication (2FA)
  - API key management

---

## Screenshots

### Login Screen

![Login](/screenshots/login-screen.png)

### Instance Monitoring

![Instance Details](/screenshots/instance-detail.png)

### Setup Documentation

![Setup Docs](/screenshots/setup-docs.png)

---

## Quick Links

### Getting Started

- [System Requirements](/setup/getting-started/requirements)
- [Choosing a VPS Provider](/setup/getting-started/hosting)
- [Linux Server Basics](/setup/server-setup/linux-basics)

### Deployment

- [Single Server Deployment](/setup/deployment/single-server)
- [Split Hosting (Frontend/Backend)](/setup/deployment/split-hosting)
- [GitHub Actions CI/CD](/setup/deployment/github-actions)

### Configuration

- [Environment Variables](/setup/configuration/environment)
- [Nginx Setup](/setup/configuration/nginx)
- [PM2 Process Manager](/setup/configuration/pm2)

---

## Features at a Glance

### Instance Management

- [x] Create and control Supabase instances
- [x] Start, stop, restart actions
- [x] Instance health monitoring

### Monitoring

- [x] Real-time metrics via WebSocket
- [x] CPU, memory, disk usage charts
- [x] Live log streaming

### Backup System

- [x] Scheduled backups
- [x] Retention policies
- [x] One-click restore

### Alert System

- [x] CPU, memory, health-based rules
- [x] Email notifications
- [x] Webhook notifications (Slack, Discord)

### User Management

- [x] Role-based access (Admin, User, Viewer)
- [x] Two-factor authentication
- [x] Session management

### API & Automation

- [x] API key generation
- [x] Scoped permissions
- [x] Usage tracking

### Templates

- [x] Reusable instance configurations
- [x] Small, Medium, Large presets

### Audit & Compliance

- [x] Audit logging
- [x] Action history
- [x] Searchable logs

---

## Technology Stack

**Frontend:**

- React 19
- Vite
- TailwindCSS
- Socket.IO (real-time)

**Backend:**

- Node.js
- Express
- Prisma ORM

**Database:**

- SQLite (development)
- PostgreSQL (production)

**Container Runtime:**

- Docker
- Docker Compose

---

## Version Information

- **Current Version:** 1.1
- **Release Date:** January 2026

[View Version History →](/setup/general/versions)
