# UTILS - Developer Productivity Suite

A centralized utility dashboard built with **React (Vite)** and **TypeScript**, styled with **Tailwind CSS**, and secured via **Firebase Authentication**.

The flagship tool currently implemented is the **JD Screener Bot**, which uses Generative AI to analyze Job Descriptions against a pool of resumes to find the best match and suggest improvements.

## Features

* **Google Authentication**: Secure login via Firebase Auth with `AuthGuard` protection.
* **JD Screener**:
    * Accepts raw Job Description text.
    * Authenticates with a Python Cloud Function backend using Bearer tokens.
    * Renders AI-generated analysis in clean Markdown (using `react-markdown` & `remark-gfm`).
* **Modern Stack**: Fast build times with Vite and type safety with TypeScript.

## Tech Stack

* **Frontend**: React 18, TypeScript, Vite
* **Styling**: Tailwind CSS
* **Auth**: Firebase (Google Provider)
* **Backend**: Google Cloud Functions (Python Gen2), Vertex AI (Gemini Pro)
* **Deployment**: Vercel

## Prerequisites

Before you begin, ensure you have the following:
* Node.js (v18 or higher)
* A Firebase Project with "Google Auth" enabled.
* A Google Cloud Function deployed (for the JD Screener API).

## Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/your-username/jd-screener-resume-picker-ui.git](https://github.com/your-username/jd-screener-resume-picker-ui.git)
    cd jd-screener-resume-picker-ui
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory. **Do not commit this file.**
    
    ```ini
    # Firebase Config (Found in Firebase Console -> Project Settings)
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your-project-id
    VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id

    # Backend API URL (Google Cloud Function)
    VITE_JD_SCREENER_API_URL=[https://us-central1-your-project.cloudfunctions.net/jd-screener-bot-v2](https://us-central1-your-project.cloudfunctions.net/jd-screener-bot-v2)
    ```

## Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Project Structure
```markdown
src/
├── components/
│   └── AuthGuard.tsx       # Protects routes requiring login
├── pages/
│   └── JDScreener.tsx      # Main UI for the resume picker tool
├── config.ts               # Type-safe environment variable loader
├── firebase.ts             # Firebase init and auth helpers
├── App.tsx                 # Routing and Layout
└── main.tsx                # Entry point
```

## Deployment (Vercel)
This project is optimized for Vercel.
1. Push your code to GitHub.
1. Import the repository in Vercel.
1. Important: Add the Environment Variables from your .env file into the Vercel Project Settings.
1. Vercel will automatically detect Vite and deploy.

## Contributing
1. Fork the Project
1. Create your Feature Branch `(git checkout -b feature/AmazingFeature)`
1. Commit your Changes `(git commit -m 'Add some AmazingFeature')`
1. Push to the Branch `(git push origin feature/AmazingFeature)`
1. Open a Pull Request
