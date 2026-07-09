# Anchor — AI-Powered Clarity, Decision Intelligence & Personal Growth Platform

Anchor is a production-ready SaaS application designed to help users stop overthinking, map out intentional actions, resolve complex decisions, track daily consistency, build habits, and discover career/learning opportunities.

---

## ⚓ Key Features
- **Daily Journaling**: Logs thoughts, mood, confidence, stress, and energy metrics to build long-term context.
- **Decision Intelligence Engine**: Evaluates dilemmatic pros/cons, risk matrices, and long-term impacts to formulate actionable roadmaps.
- **SWOT Analysis Radar**: Automatically generates SWOT quadrants and personalized growth recommendations.
- **Opportunity Radar**: Discovers jobs, internships, startup pitches, and learning meetups from reflections.
- **Gamification & Consistency Tracker**: Awards XP, levels, and badges (e.g. 7 Day Thinker, Decision Master).
- **Interactive UI responses**: AI answers are structured in responsive card widgets rather than raw markdown.
- **Voice AI Assistant**: Hands-free continuous Speech-to-Text and Text-to-Speech playback controls.
- **Progressive Web App (PWA)**: Installable, lightweight native-like mobile app support with offline fallback caching.

---

## 🛠️ Technology Stack
- **Frontend**: Vite, React, TypeScript, Tailwind CSS, Zustand, Recharts, Framer Motion, TanStack Query.
- **Backend**: Django REST Framework, SimpleJWT, MySQL (using pymysql), Celery, Redis.
- **AI Model**: Google Gemini API (`gemini-1.5-flash` for answers, `text-embedding-004` for semantic memory vector matching).

---

## 🚀 Getting Started

### Local Setup

#### 1. Backend Server Setup
1. Open a terminal in the `./backend` directory.
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run migrations to initialize the MySQL database schema:
   ```bash
   python manage.py migrate
   ```
4. Start the development server (runs on port 8000):
   ```bash
   python manage.py runserver
   ```

#### 2. Frontend App Setup
1. Open another terminal in the `./frontend` directory.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server (runs on port 3000):
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:3000`.

---

## 🐳 Docker Deployment
To start all services (MySQL, Redis, Celery, Backend, Frontend) in containers:
```bash
docker-compose up --build
```
Once initialized:
- Frontend will be accessible at: `http://localhost:3000`
- Backend API will run at: `http://localhost:8000`
