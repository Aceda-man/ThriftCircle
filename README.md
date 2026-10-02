### ThriftCircle

> **Author:** Precious Omolaolu (Technical Writing Track)  
> **Deliverables:** Project README & API Specifications  
> **Project:** Digital Àjọ / Èsúsú Management Platform
> 

**ThriftCircle** is a digital platform designed to make traditional **Àjọ / Èsúsú / Thrift** savings groups simple, transparent, and organized. It automates contribution tracking, payout scheduling, proof-of-payment checks, and automated reminders—replacing messy paper notebooks and cluttered group chats with a structured system.

### Key Features
* **Flexible Sign-Up & Login:**
  * **Sign-Up:** Requires complete user credentials, including password confirmation.
  * **Login:** Accepts either **Email OR Phone Number**.
* **Dynamic Role Assignment (RBAC):**
  * Initial registration creates a base user account.
  * Specific roles (**Organizer** vs. **Member**) are assigned dynamically when a user creates or joins a group.
* **Automated Contribution Engine:**
  * A background system engine checks group due dates automatically to generate upcoming contribution targets based on group frequency.
* **Payment Evidence & Verification:**
  * Members upload receipt images directly within the app for organizer verification.
* **Payout Management & Reminders:**
  * Automated tracking for payout rotational order and automated alerts for upcoming or missed payments.

### Technology Stack
* **Frontend:** React Native, Expo, Expo Router, TypeScript, JavaScript, HTML, CSS, Tailwind CSS
* **Backend:** Node.js (v26.4.0+ recommended), Express, MongoDB Atlas (Mongoose)
* **Security & Auth:** jsonwebtoken (JWT), bcrypt, helmet, express-rate-limit, cors
* **File Uploads:** multer, cloudinary
* **Tools & Testing:** VS Code, Git, GitHub, Nodemon, Postman / Thunder Client

### Security Rules & Token Management
* **Access Token:** Lasts **5 minutes**. *(Mobile developers must implement a silent refresh mechanism to prevent unexpected user logouts).*
* **Refresh Token:** Valid for **30 days**.
* **Rate Limiting:** Request throttling via express-rate-limit. Clicking /login or /reset-password more than **10 times** rapidly triggers an automatic **15-minute system lockout**.

### Local Development Setup

#### Prerequisites
1. **Node.js** (v26.4.0+ recommended) & **npm**.
2. **Git** installed.
3. **MongoDB Atlas** account and cluster connection URI.
4. **Cloudinary Account** (configured via team/product email for receipt hosting).

#### Step-by-Step Installation
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/preeshy2005-ship-it/ThriftCircle-doc.git](https://github.com/preeshy2005-ship-it/ThriftCircle-doc.git)
   cd ThriftCircle-doc
