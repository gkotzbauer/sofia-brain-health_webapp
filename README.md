# Sofia - Brain Health Story Companion

A conversational AI companion that helps older adults create their personal brain health transformation story through narrative therapy and evidence-based interventions.

## Features
- 🧠 Personalized brain health journey tracking
- 📖 Story-based narrative therapy approach
- 📄 Intelligent document upload and profile extraction
- 🔒 HIPAA-compliant with PHI encryption
- 🚨 Real-time safety monitoring with clinical alerts
- 📊 Comprehensive audit trail for compliance

## Tech Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express.js, PostgreSQL
- **Security**: JWT authentication, AES encryption, Helmet.js
- **Deployment**: Render (Web Service + PostgreSQL)

## Local Development

### Prerequisites
- Node.js 16+
- PostgreSQL 13+

### Setup
1. Clone the repository
2. Set up the backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials