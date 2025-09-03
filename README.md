# 📡 StudyEase Backend

This is the **backend service** for **StudyEase**, a student productivity toolkit.  
It provides REST APIs for managing **classes, budgets, study plans, and AI-generated quizzes**.  

Built with **Node.js, Express.js, MongoDB**, and integrated with **Google Gemini 2.5 Flash AI**.

---

## ⚙️ Tech Stack
- Node.js + Express.js  
- MongoDB Atlas  
- Google Gemini 2.5 Flash AI  

---

## 📌 API Endpoints

### 📅 Classes
- `POST /classes` → Add a class  
- `GET /classes/:email` → Get all classes for a user (sorted by day/time)  
- `PATCH /class/:id` → Update class schedule  
- `DELETE /class/:id` → Delete a class  

---

### 💰 Budget Tracker
- `POST /budget` → Add income/expense/saving  
- `GET /budget/:email` → Get all budget entries for user  
- `GET /budget-graph/:email` → Get totals for chart (expense & saving)  

---

### 📝 Study Planner
- `POST /plan` → Add a study plan task  
- `GET /plan/:email` → Get all tasks for a user  
- `PUT /plan` → Update task status  

---

### 📖 Exam Q&A
- `GET /quizes` → Get quizzes (filter by subject & difficulty)  

---

### 🤖 AI Quiz Generator
- `POST /quiz-ai` → Generate multiple-choice quizzes dynamically using **Gemini AI**  

---

## 📌 Notes
- All collections stored in one database `StudyEase`:
  - `classes`
  - `budgets`
  - `plans`
  - `quizes`  
- Supports full CRUD operations.  
- AI-powered quiz generation adds **unique functionality** to the app.  

---
