# ThriftCircle — API Reference

> **Author:** Precious Omolaolu  
> **Base URL:** `https://api.thriftcircle.com/api/v1`  

---

## Plain-English API Glossary
* **API:** The digital communication channel connecting the mobile client to the database server.
* **Endpoint:** A specific URL path used to perform an action (e.g., `/auth/login` or `/payments/upload-proof`).
* **JWT Token:** A temporary digital pass issued after login to verify identity and permissions.
* **Cloudinary:** A secure cloud service used to store payment receipt images uploaded by users.

---

## 1. Authentication Endpoints

### POST `/auth/signup`
Registers a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "08012345678",
  "password": "Password123",
  "confirmPassword": "Password123"
}

```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully"
}

```
### POST /auth/login
Authenticates a user using either email or phone number.
**Request Body:**
```json
{
  "loginIdentifier": "user@example.com", 
  "password": "Password123"
}

```
**Response (200 OK):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi..."
}

```
*Note: Triggers an automatic 15-minute system lockout after 10 rapid failed attempts.*
### POST /auth/refresh
Generates a new short-lived access token using a valid 30-day refresh token.
**Headers:**
Authorization: Bearer <refreshToken>
**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOi..."
}

```
## 2. Group Management & Roles
### POST /groups/create
Creates a new savings group. Automatically assigns the creating user the **Organizer** role for that group.
### POST /groups/join
Joins an existing group via an invite link/code. Automatically assigns the joining user the **Member** role for that group.
## 3. Payment Evidence & Storage
### POST /payments/upload-proof
Uploads payment receipt images directly to Cloudinary.
**Header:**
Content-Type: multipart/form-data
**Form Data Fields:**
 * groupId: String
 * receiptImage: File (Image binary)
**Response (200 OK):**
```json
{
  "success": true,
  "imageUrl": "[https://res.cloudinary.com/thriftcircle/image/upload/v12345/receipt.jpg](https://res.cloudinary.com/thriftcircle/image/upload/v12345/receipt.jpg)",
  "status": "Pending Verification"
}

```
```

```
