# 🛒 QuickShop Scraper

A full-stack application for scraping product data from Blinkit, Zepto, and Swiggy Instamart platforms. This application allows users to search for products, see results in real-time, add items to cart, and view their cart.

## ✨ Features

- Search products by location and search term
- Real-time scraping from multiple quick commerce websites
- Add products to cart
- View and manage shopping cart
- WebSocket communication for real-time updates

## 🏗️ Project Structure

```
login/
├── backend/                   # Express.js backend with WebSocket and Puppeteer
│   ├── blinkit/               # Blinkit specific scraping logic
│   ├── zepto/                 # Zepto specific scraping logic
│   ├── instamart/             # Swiggy Instamart specific scraping logic
│   ├── server.js              # Main server application file
│   └── package.json           # Backend dependencies
├── frontend/                  # React + TypeScript + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/        # UI components for product listing and cart
│   │   │   └── ui/            # Reusable UI components
│   │   ├── assets/            # Image assets for platforms
│   │   ├── App.tsx            # Main application component
│   │   └── main.tsx           # Entry point
│   └── package.json           # Frontend dependencies
├── .env.example               # Example environment variables
└── render.yaml                # Render deployment configuration
```

## 🔧 Technical Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web server framework
- **WebSocket** - Real-time communication
- **Puppeteer** - Headless browser automation
- **dotenv** - Environment variable management

### Frontend
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Build tool and development server
- **Radix UI** - Accessible component primitives

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Chrome/Chromium browser
- Mobile phone for OTP verification

### Installation

1. **Install Backend Dependencies:**
```powershell
cd backend
npm install
```

2. **Install Frontend Dependencies:**
```powershell
cd frontend
npm install
```

### Running the Application

#### Method 1: Full-Stack Dashboard (Recommended)

1. **Start the Backend Server:**
```powershell
cd backend
npm start
```
The backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server:**
```powershell
cd frontend
npm run dev
```
The frontend will run on `http://localhost:5173`

3. **Access the Dashboard:**
Open your browser and go to `http://localhost:5173`

#### Method 2: CLI Script (Original)

```powershell
node srever.js
```

## 🚀 Production Deployment (Render)

This section provides instructions for deploying the application to [Render](https://render.com/).

### Using render.yaml (Recommended Method)

This project includes a `render.yaml` file for easy deployment to Render using their Blueprint feature:

1. **Fork or Push the Repository to GitHub**
   - Ensure your repository is on GitHub and is public or connected to your Render account

2. **Create a New Blueprint on Render**
   - Go to the Render dashboard
   - Click "New" → "Blueprint"
   - Select your repository
   - Render will automatically detect the `render.yaml` file and create both services

3. **Verify and Deploy**
   - Review the settings for both services
   - Click "Apply" to start the deployment process

The `render.yaml` file will set up:
- Backend Web Service with proper Puppeteer configuration
- Frontend Static Site
- Environment variables with proper cross-referencing between services

### Manual Deployment

This section provides instructions for deploying the application to [Render](https://render.com/).

### Environment Setup

Create a `.env` file in the backend directory with the following variables:

```
PORT=5000
FRONTEND_URL=https://your-frontend-app-name.onrender.com
NODE_ENV=production
```

### Backend Deployment

1. **Create a Web Service on Render**
   - Sign in to your Render account
   - Click "New" and select "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `quickshop-backend` (or your preferred name)
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Root Directory**: backend

2. **Configure Environment Variables**
   - Under the "Environment" tab, add:
     - `PORT`: `10000` (Render assigns port 10000 internally)
     - `FRONTEND_URL`: The URL of your frontend deployment
     - `NODE_ENV`: `production`

3. **Add Advanced Settings for Puppeteer**
   - Set "Instance Type" to at least 1GB RAM
   - Under "Health Check Path" enter `/api/health`
   - Under "Environment" > "Secret Files", add a file named `.puppeteerrc.cjs` with:
     ```js
     const { join } = require('path');
     module.exports = {
       cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
     };
     ```

### Frontend Deployment

1. **Create a Static Site on Render**
   - Click "New" and select "Static Site"
   - Connect your GitHub repository
   - Configure the site:
     - **Name**: `quickshop-frontend` (or your preferred name)
     - **Build Command**: `cd frontend && npm install && npm run build`
     - **Publish Directory**: `frontend/dist`

2. **Configure Environment Variables**
   - Create a file named `.env` in the frontend directory:
     ```
     VITE_API_URL=https://your-backend-app-name.onrender.com
     VITE_WS_URL=wss://your-backend-app-name.onrender.com
     ```

3. **Update Frontend Code**
   - Make sure your frontend code uses environment variables:
     ```tsx
     const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
     const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000";
     ```

### Troubleshooting Production Deployment

1. **Puppeteer Issues**
   - If you encounter Puppeteer errors, ensure your Render service has adequate resources (at least 1GB RAM)
   - Check Render logs for Chromium startup errors

2. **CORS Issues**
   - Verify that the FRONTEND_URL environment variable is set correctly
   - Check that CORS is properly configured in the backend

3. **WebSocket Connection Failures**
   - Ensure you're using `wss://` (secure WebSocket) in production, not `ws://`
   - Verify the WebSocket server is properly initialized in production mode

4. **Browser Crashes**
   - Adjust Puppeteer launch arguments to optimize for cloud environment:
     ```javascript
     const browser = await puppeteer.launch({
       headless: "new",
       args: [
         '--no-sandbox',
         '--disable-setuid-sandbox',
         '--disable-dev-shm-usage',
         '--disable-accelerated-2d-canvas',
         '--no-first-run',
         '--no-zygote',
         '--disable-gpu'
       ]
     });
     ```

### Development

#### Backend Development
```powershell
cd backend
npm run dev     # Start with nodemon
```

#### Frontend Development
```powershell
cd frontend
npm run dev     # Start Vite dev server
npm run build   # Build for production
npm run preview # Preview production build
```

#### Environment Variables
Create `.env` file in backend directory:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## 🔧 API Endpoints

### Backend API (`http://localhost:5000`)

- `GET /api/health` - Health check
- `GET /api/results` - List all result files
- `GET /api/results/:filename` - Get specific result file
- `POST /api/scrape` - Start scraping process

## 📋 Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for backend server | `5000` |
| `FRONTEND_URL` | URL of frontend for CORS | `http://localhost:5173` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `PUPPETEER_HEADLESS` | Puppeteer headless mode | `false` in dev, `"new"` in prod |

### Frontend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:5000` |

> **Note:** You don't need `.env.production` files. We use a single `.env` file approach and configure the environment variables directly on the Render dashboard for production deployments.

Copy the example .env files to get started:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## 📁 File Structure

### Generated Files
- `blinkit_[searchterm]_results.json` - Blinkit results
- `zepto_[searchterm]_results.json` - Zepto results

### Result File Format
```json
{
  "platform": "Blinkit",
  "searchTerm": "kurkure",
  "location": "sector 62 noida",
  "totalProducts": 15,
  "extractedAt": "2025-06-11T...",
  "products": [
    {
      "id": "product_1",
      "name": "Kurkure Masala Munch",
      "price": "₹20",
      "originalPrice": "₹25",
      "savings": "₹5",
      "quantity": "55g",
      "deliveryTime": "8 MINS",
      "discount": "20% OFF",
      "imageUrl": "https://...",
      "available": true
    }
  ]
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Selector Not Found Errors:**
   - Websites may have updated their structure
   - Check console logs for specific selectors
   - Update selectors in scraping functions

2. **OTP Issues:**
   - Ensure mobile number is correct
   - Check phone for SMS
   - Some platforms may require app-based OTP

3. **Browser Crashes:**
   - Close other Chrome instances
   - Restart the scraping process
   - Check system memory

4. **Network Timeouts:**
   - Check internet connection
   - Websites may have rate limiting
   - Try again after a few minutes

### Debug Mode
Enable detailed logging by setting environment variable:
```powershell
$env:DEBUG="puppeteer:*"; npm start
```

## 🔄 Updates & Maintenance

The scraping logic may need updates when websites change their structure. Key areas to monitor:

1. **Location Input Selectors** - Both platforms
2. **Search Input Selectors** - Search functionality
3. **Product Card Selectors** - Product extraction
4. **OTP Input Selectors** - Authentication

## 🛡️ Security Considerations

When deploying to production, consider the following security best practices:

1. **Secure WebSocket Connections**
   - Always use `wss://` protocol in production instead of `ws://`
   - Ensure proper origin verification in WebSocket server

2. **CORS Configuration**
   - Restrict CORS to only the domains you need
   - In production, set `FRONTEND_URL` environment variable to your exact frontend URL

3. **Rate Limiting**
   - Consider implementing rate limiting to prevent abuse
   - Use packages like `express-rate-limit` for API endpoints

4. **Environment Variables**
   - Never commit `.env` files to source control
   - Use different credentials for development and production

5. **Puppeteer Security**
   - Always use headless mode in production
   - Use `--no-sandbox` only when necessary and understand its implications
   - Consider running in a container with limited privileges

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Puppeteer Documentation](https://pptr.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://react.dev/)

## 📞 Support

For issues with:
- **Website Structure Changes**: Update selectors in backend
- **OTP Problems**: Check phone number and platform requirements
- **Performance Issues**: Monitor browser memory usage

## 🎉 Success!

When everything is working correctly, you should see:
- ✅ Backend running on port 5000
- ✅ Frontend accessible at localhost:5173
- ✅ Beautiful dashboard interface
- ✅ Successful product scraping
- ✅ JSON files generated with results

Happy scraping! 🚀
#   Q u i c k C o m p a r e  
 