# Sofia Frontend Deployment Guide

## Quick Setup

1. **Update API Configuration**: Edit `js/config.js` and replace `your-render-app-name` with your actual Render app name
2. **Deploy to any static hosting service** (GitHub Pages, Netlify, Vercel, etc.)

## Configuration

### API URL Setup

In `js/config.js`, update the API_BASE_URL:

```javascript
const SofiaConfig = {
    API_BASE_URL: 'https://your-actual-app-name.onrender.com/api',
    // ... other config
};
```

### Environment Detection

The app automatically detects:
- **Localhost**: Uses `http://localhost:10000/api` for development
- **Production**: Uses the URL from `SofiaConfig.API_BASE_URL`

## Deployment Options

### Option 1: GitHub Pages (Free)
1. Push your frontend code to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Set source to main branch or /docs folder

### Option 2: Netlify (Free)
1. Connect your GitHub repository to Netlify
2. Set build command: (none needed - static site)
3. Set publish directory: `frontend/`

### Option 3: Vercel (Free)
1. Connect your GitHub repository to Vercel
2. Vercel will auto-detect it's a static site
3. Deploy automatically

### Option 4: Render Static Site (Free)
1. Create a new Static Site service in Render
2. Connect your GitHub repository
3. Set build command: (none needed)
4. Set publish directory: `frontend/`

## Testing

1. **Local Testing**: Open `index.html` in a browser
2. **API Testing**: Ensure your backend is running on Render
3. **Integration Testing**: Test authentication and data flow

## Features

- ✅ **Responsive Design**: Works on desktop, tablet, and mobile
- ✅ **Offline Support**: Caches data locally when offline
- ✅ **API Integration**: Full backend connectivity
- ✅ **Modern UI**: Clean, accessible interface
- ✅ **Cross-browser**: Works in all modern browsers

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your Render backend has proper CORS configuration
2. **API Connection**: Verify the API_BASE_URL is correct
3. **Authentication**: Check that JWT tokens are being sent properly

### Debug Mode

Enable debug mode in `config.js`:
```javascript
DEBUG_MODE: true,
LOG_LEVEL: 'debug'
``` 