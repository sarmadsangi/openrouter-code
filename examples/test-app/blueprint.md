# QA Test Application Blueprint

## Project Overview
A simple Express.js web application designed for testing QA automation capabilities.

## Server Configuration
**Start Command:** `npm run dev`
**Port:** 3000
**Base URL:** http://localhost:3000
**Health Check:** /api/health
**Startup Timeout:** 15

## QA Testing Configuration

### Test Cases
- Verify home page loads and displays correctly
- Test navigation between pages (Home, About)
- Validate contact form functionality and validation
- Test API endpoints and error handling
- Check responsive design elements
- Verify 404 error page handling

### Custom Prompts
- Test the contact form with valid and invalid data
- Verify all navigation links work correctly
- Check that error messages display properly

### Browser Configuration
**Browsers:** chromium
**Viewport:** 1280x720

## Features
- **Navigation**: Header navigation with smooth scrolling
- **Contact Form**: Full form with validation and API submission
- **Error Handling**: 404 page and form validation errors
- **API Integration**: Health check and contact endpoints
- **Responsive Design**: Mobile-friendly layout

## API Endpoints
- GET / - Home page
- GET /about - About page  
- GET /api/health - Health check endpoint
- POST /api/contact - Contact form submission

## Development
```bash
cd examples/test-app
npm install
npm run dev
```