# 🛒 ShopNow — Full-Stack E-Commerce Platform

ShopNow is a full-stack e-commerce web application featuring a customer storefront and a comprehensive admin dashboard.

The application is built with **HTML5, CSS3, and Vanilla JavaScript** on the frontend, **Node.js and Express.js** on the backend, and **MongoDB** for persistent data storage. It provides REST APIs for authentication, products, categories, navigation, customers, orders, coupons, reviews, payments, and store settings.

---

## ✨ Features

### 🛍️ Customer Storefront

* Home page
* Product browsing and search
* Product details
* Category and product filtering
* Shopping cart
* Wishlist
* Checkout
* Razorpay payment integration
* Order management
* Order tracking
* Returns
* Address management
* Account settings
* Payment settings
* Shipping information
* Help and support
* Contact page
* Device support

### 🧑‍💼 Admin Dashboard

* Admin authentication
* Dashboard overview
* Product catalog management
* Create, edit, and delete products
* Product image and video management
* Category management
* Category taxonomy management
* Navigation management
* Order management
* Customer/user management
* Coupon management
* Review management
* Store and commerce settings
* Email configuration
* Payment configuration
* Reports and administration tools

---

## 📦 Product Management

ShopNow uses a centralized product management system.

Administrators can:

* Create products
* Edit products
* Delete products
* Upload product images
* Manage product videos
* Assign products to categories
* Manage product information
* Manage category-specific attributes
* Filter products

Product attributes can change according to the selected category.

For example:

```text
Electronics
 ├── RAM
 ├── Storage
 ├── Battery
 ├── Camera
 └── Warranty
```

**Category Products** is implemented as a filtered view of the main product catalog rather than as a separate product-management system.

---

## 🧭 Category & Navigation System

ShopNow supports a four-level hierarchical category structure:

```text
Category
   ↓
Section
   ↓
Group
   ↓
Item
```

Example:

```text
Electronics
 └── Mobiles
      └── Smartphones
           └── iPhone
```

This hierarchy is used for:

* Storefront navigation
* Category management
* Product categorization
* Product creation
* Admin taxonomy management

---

## 🔐 Authentication & Authorization

The application uses **JWT-based authentication** with role-based access control.

Supported roles include:

* Admin
* Manager
* Staff
* Customer

Authentication functionality includes:

* User registration
* Login
* Logout
* Protected API routes
* Role-based authorization
* Password hashing
* Admin account creation
* Customer account management

---

## 🔌 REST API

The Express.js backend provides REST APIs for the main application functionality.

### Authentication

```text
POST   /api/register
POST   /api/login
GET    /api/profile
PUT    /api/profile
POST   /api/logout
```

### Products

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

### Categories

```text
GET    /api/categories
POST   /api/categories
```

### Orders

```text
GET    /api/orders
POST   /api/orders
```

### Users

```text
GET    /api/users
```

### Navigation

```text
GET    /api/navigation
POST   /api/navigation
PUT    /api/navigation/:id
DELETE /api/navigation/:id
```

Additional APIs support features such as coupons, reviews, settings, payments, and other e-commerce functionality.

---

## 💳 Orders & Payments

ShopNow supports:

* Order creation
* Order management
* Order status updates
* Order tracking
* Returns
* Checkout
* Invoice-related functionality
* Razorpay checkout integration

### Payment Security

Payment credentials are not hardcoded in the application source code.

Credentials should be supplied through secure environment variables or the appropriate admin configuration.

For development, use test/sandbox credentials. Production credentials must be stored securely on the production server.

---

## ⭐ Coupons, Reviews & Wishlist

The platform also includes:

* Coupon management
* Product reviews
* Review moderation
* Wishlist functionality
* Customer-specific data
* MongoDB-backed persistence

---

# 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript

### Backend

* Node.js
* Express.js
* REST APIs
* Mongoose
* JWT
* bcryptjs
* Multer
* Nodemailer

### Database

* MongoDB
* MongoDB Atlas for production

### Security

* Helmet
* CORS
* Express Rate Limit
* Express Mongo Sanitize
* JWT authentication
* Password hashing
* Environment variables

### Production

* Nginx
* PM2
* HTTPS / SSL
* MongoDB Atlas
* Node.js

---

# 🗄️ Database

MongoDB is the application's persistent database.

Data such as the following is stored in MongoDB:

* Users and customers
* Products
* Categories
* Orders
* Navigation
* Coupons
* Reviews
* Application settings

JSON data files are not used as the runtime database.

---

# 📁 Project Structure

```text
ShopNow/
│
├── .gitignore
├── README.md
│
├── admin/
│   ├── admin.html
│   ├── dashboard.js
│   ├── commerce-manager.js
│   ├── settings-manager.js
│   └── taxonomy-manager.js
│
├── frontend/
│   ├── user.html
│   ├── login.html
│   ├── account-settings.html
│   ├── addresses.html
│   ├── checkout.html
│   ├── contact-us.html
│   ├── device-support.html
│   ├── help.html
│   ├── orders.html
│   ├── payment-settings.html
│   ├── product-details.html
│   ├── returns.html
│   ├── shipping-info.html
│   ├── track-order.html
│   └── ...
│
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── ecosystem.config.cjs
│   │
│   ├── src/
│   │   ├── models/
│   │   └── services/
│   │
│   ├── scripts/
│   │   └── create-admin.js
│   │
│   ├── deploy/
│   │   └── nginx.conf
│   │
│   ├── .env.example
│   └── .env.production.example
│
├── setup.bat
└── start-server.bat
```

---

# ⚙️ Environment Configuration

Sensitive configuration is stored using environment variables.

### Local Development

Copy:

```text
backend/.env.example
```

to:

```text
backend/.env
```

Then configure the required values.

### Production

On the production server, copy:

```text
backend/.env.production.example
```

to:

```text
backend/.env
```

and configure the real production values.

### Important

Real credentials must **never** be committed to GitHub.

Do not commit:

```text
.env
.env.production
```

Example files can be committed:

```text
.env.example
.env.production.example
```

However, example files must contain **placeholders only**.

Example:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
COOKIE_SECRET=your_cookie_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

---

# 💻 Local Development

## 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd ShopNow
```

## 2. Install dependencies

```bash
cd backend
npm install
```

## 3. Configure environment variables

Copy:

```text
.env.example
```

to:

```text
.env
```

Configure your MongoDB connection and required application secrets.

## 4. Create the administrator account

```bash
npm run create-admin -- "Admin Name" admin@example.com "YOUR_SECURE_PASSWORD"
```

Use your own secure administrator credentials.

## 5. Start the application

```bash
npm start
```

For development with automatic reload, if configured:

```bash
npm run dev
```

---

## 🌐 Local URLs

### Customer Website

```text
http://localhost:5000/frontend/user.html
```

### Admin Dashboard

```text
http://localhost:5000/admin/admin.html
```

---

# 🚀 Production Deployment

Recommended production architecture:

```text
                    Internet
                       │
                       ▼
                 Customer Browser
                       │
                       ▼
                    Nginx
                       │
                       ▼
               Node.js + Express
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       REST APIs   Frontend/Admin  Uploads
          │
          ▼
      MongoDB Atlas
```

### Production requirements

* Node.js
* MongoDB Atlas
* Nginx
* PM2
* HTTPS / SSL
* Production environment variables

Install production dependencies:

```bash
npm ci --omit=dev
```

Configure:

```text
MONGODB_URI
JWT_SECRET
COOKIE_SECRET
CLIENT_ORIGIN
PUBLIC_URL
```

Create the administrator account and start the application:

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Configure Nginx using:

```text
backend/deploy/nginx.conf
```

Replace the sample domain with your actual production domain.

Configure HTTPS/SSL using a trusted certificate authority such as Let's Encrypt.

---

# 🌍 Client Origin

`CLIENT_ORIGIN` should contain the exact public HTTPS origin of the application.

Example:

```env
CLIENT_ORIGIN=https://example.com
```

If multiple approved origins are supported by the application, they can be provided as a comma-separated list.

The backend serves both the customer storefront and admin dashboard, allowing their API requests to communicate with the same application origin.

---

# 📧 Email Configuration

SMTP can be configured for transactional email delivery.

Example:

```env
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
```

Never commit real SMTP credentials to GitHub.

---

# 🔒 Security

ShopNow includes security measures such as:

* Helmet security headers
* CORS configuration
* Express rate limiting
* MongoDB query sanitization
* JWT authentication
* Password hashing with bcryptjs
* Protected API routes
* Role-based authorization
* Environment-based secrets
* HTTPS support in production

Never commit:

```text
.env
.env.production
node_modules/
real API keys
database passwords
JWT secrets
cookie secrets
SMTP passwords
payment secrets
```

---

# 📦 Git & GitHub

The GitHub repository should contain source code and safe configuration templates.

### Safe to commit

```text
frontend/
admin/
backend source code
package.json
package-lock.json
deployment configuration
.env.example
.env.production.example
README.md
.gitignore
```

### Do not commit

```text
.env
.env.production
node_modules/
private credentials
database passwords
real API keys
local uploaded files
logs
```

Before committing changes:

```bash
git status
```

Then:

```bash
git add .
git status
git commit -m "Update ShopNow"
git push origin main
```

Always verify that sensitive files are not listed under **Changes to be committed**.

---

# 🏗️ Application Architecture

```text
                 ShopNow
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
 Customer Storefront       Admin Dashboard
   HTML/CSS/JS               HTML/JS
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
             Express.js API
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
 Authentication  E-Commerce   Settings
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
                 MongoDB
```

---

# 📌 Project Summary

ShopNow combines a customer storefront and an administrative management system into one full-stack e-commerce platform.

### Main components

```text
Frontend
HTML5 + CSS3 + JavaScript

Backend
Node.js + Express.js

Database
MongoDB

Authentication
JWT + bcryptjs

File Uploads
Multer

Email
Nodemailer / SMTP

Payments
Razorpay

Security
Helmet + CORS + Rate Limiting + Mongo Sanitization

Production
Nginx + PM2 + HTTPS + MongoDB Atlas
```

---

# 📄 License

This project is currently intended for development, internship, portfolio, and deployment purposes.

Add an appropriate open-source license before publicly distributing the project.
