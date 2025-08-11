# Sofia Brain Health Companion

A comprehensive web application designed to support brain health through personalized storytelling, goal setting, and progress tracking.

## 🚀 Live Demo

- **Backend API**: [Your Render App URL]
- **Frontend**: [Your Frontend URL]

## ✨ Features

### 🧠 Brain Health Support
- Personalized story creation and journaling
- Goal setting and progress tracking
- Safety event monitoring and intervention tracking
- Educational content and resources

### 💻 Technical Features
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: Modern HTML5 + CSS3 + JavaScript
- **Authentication**: JWT-based secure authentication
- **Offline Support**: Local storage with sync capabilities
- **Responsive Design**: Works on all devices

### 🔒 Security & Compliance
- HIPAA-compliant audit logging
- Encrypted data transmission
- Secure authentication
- Rate limiting and CORS protection

## 🏗️ Architecture

```
├── backend/           # Node.js API server
│   ├── middleware/    # Authentication, audit, error handling
│   ├── routes/        # API endpoints
│   ├── utils/         # Helper functions
│   └── server.js      # Main server file
├── frontend/          # Web application
│   ├── js/           # JavaScript modules
│   ├── index.html    # Main application
│   └── config.js     # Configuration
└── database/          # Database schema
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Modern web browser

### Backend Setup
```bash
cd backend
npm install
# Set environment variables
npm start
```

### Frontend Setup
```bash
cd frontend
# Open index.html in a browser
# Or deploy to any static hosting service
```

## 🔧 Configuration

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret-key
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

### Frontend Configuration
Edit `frontend/js/config.js` to set your API URL and preferences.

## 📱 Usage

1. **Authentication**: Create an account or login
2. **Profile Setup**: Complete your "About Me" profile
3. **Story Creation**: Write chapters about your journey
4. **Goal Setting**: Define and track personal goals
5. **Progress Monitoring**: View your progress over time
6. **Safety Support**: Log and track safety events

## 🚀 Deployment

### Backend (Render)
- ✅ Already deployed and working
- Uses Render's PostgreSQL service
- Automatic deployments from GitHub

### Frontend
- Deploy to any static hosting service
- Update API configuration
- Test integration with backend

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support or questions:
- Check the deployment guides in each directory
- Review the configuration files
- Test the API endpoints

## 🔄 Recent Updates

- ✅ Fixed middleware export/import issues
- ✅ Added root route for API documentation
- ✅ Backend successfully deployed to Render
- ✅ Frontend ready for deployment
- ✅ Complete API integration working

---

**Sofia Brain Health Companion** - Supporting your mental health journey through technology.
