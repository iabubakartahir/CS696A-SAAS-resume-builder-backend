# CS696A- SaaS Resume Buildder (Backend)
Manual API testing was conducted to validate authentication flows, resume management endpoints, AI services, file parsing, and export functionality.

## Architecture

### Tech Stack
Frontend: React 18.3 + Vite 6.0
Routing: React Router DOM v7
HTTP Client: Axios
Styling: CSS Modules + Inline Styles
State: React Context API + Hooks

## API Endpoints
### Authentication

POST /api/v1/auth/signup — Register a new user

POST /api/v1/auth/login — Authenticate user and start session

POST /api/v1/auth/refresh — Refresh access token

GET /api/v1/auth/google — Google OAuth authentication

GET /api/v1/auth/linkedin — LinkedIn OAuth authentication

### Resume Management

GET /api/v1/resumes — Retrieve all user resumes

POST /api/v1/resumes — Create a new resume

PATCH /api/v1/resumes/:id — Update an existing resume

DELETE /api/v1/resumes/:id — Delete a resume

GET /api/v1/resumes/:id/preview — Generate resume preview

GET /api/v1/resumes/:id/export/:format — Export resume (PDF/DOCX/TXT)

### AI Services

POST /api/v1/ai/suggest — Generate AI-powered resume content suggestions

### File Handling

POST /api/v1/files/parse — Parse uploaded resume files

POST /api/v1/files/import — Import parsed resume data


## Architecture
### Repository Structure

 CS696A-SAAS-Resume-builder-frontend
 ┣ public/
 ┣ src/
 ┣ ┣ App.jsx
 ┣ ┣ main.jsx
 ┣ INTEGRATION_GUIDE.md
 ┣ NETLIFY_DEPLOYMENT.md
 ┣ START_HERE.md
 ┣ README.md
 ┣ tailwind.config.js
 ┣ vite.config.js
 ┗ ..etc
