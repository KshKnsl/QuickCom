# 🛒 QuickCom Scraper

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
```

## 🔧 Technical Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web server framework
- **WebSocket** - Real-time communication
- **Puppeteer** - Browser automation
- **dotenv** - Environment variable management

### Frontend
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Build tool and development server

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Chrome/Chromium browser

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

## 📞 Support

For issues with:
- **Website Structure Changes**: Update selectors in backend

## 🎉 Success!

When everything is working correctly, you should see:
- ✅ Backend running on port 5000
- ✅ Frontend accessible at localhost:5173
- ✅ Beautiful dashboard interface
- ✅ Successful product scraping
- ✅ JSON files generated with results

Happy scraping! 🚀