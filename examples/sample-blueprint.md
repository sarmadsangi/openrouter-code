# Sample Web Application Blueprint

## Project Overview
This is a sample web application for demonstrating QA agent capabilities.

## Server Configuration
**Start Command:** `npm run dev`
**Port:** 3000
**Base URL:** http://localhost:3000
**Health Check:** /api/health
**Startup Timeout:** 30

## QA Testing Configuration

### Test Cases
- Verify home page loads correctly
- Test navigation menu functionality
- Validate contact form submission
- Check responsive design on mobile viewport
- Test user authentication flow

### Custom Prompts
- Test all form validations work correctly
- Verify error handling for network failures
- Check accessibility features are working

### Skip Tests
- Payment integration (requires test credentials)
- Email sending functionality (requires email server)

### Browser Configuration
**Browsers:** chromium, firefox
**Viewport:** 1280x720

## Features to Test
- **Navigation**: Header menu, footer links, breadcrumbs
- **Forms**: Contact form, newsletter signup, search
- **Interactive Elements**: Buttons, dropdowns, modals
- **Content**: Dynamic content loading, image galleries
- **Error Handling**: 404 pages, form validation errors

## API Endpoints
- GET /api/health - Health check
- POST /api/contact - Contact form submission
- GET /api/users - User data (requires auth)

## Development Setup
```bash
npm install
npm run dev
```

The application will be available at http://localhost:3000